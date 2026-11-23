import type { DragEvent } from '@interactjs/actions/drag/plugin'
import type { DropEvent } from '@interactjs/actions/drop/DropEvent'
import interact from '@interactjs/interact'
import type { PointerEvent as InteractPointerEvent } from '@interactjs/pointer-events/PointerEvent'
import { computed, createEffectScope, onScopeDispose, ref, watch } from 'fine-jsx'

import { DEFAULT_STILL_CLIP_DURATION_S } from '#constants'
import type * as pub from '#core'
import { useEventListener } from 'shared/utils/composables.ts'
import { clamp, Rational } from 'shared/utils/math.ts'

import { moveAndFillGaps } from './utils.ts'

import '@interactjs/auto-start'
import '@interactjs/pointer-events'

type Target =
  | { trackId: string; index: number; before: false; time: number; asset: pub.AnyAsset; duration: number }
  | {
      beforeTrackId: string
      index: number
      before: true
      time: number
      asset: pub.AnyAsset
      duration: number
    }

export class AssetDragContext {
  #editor: pub.VideoEditor
  readonly #scope = createEffectScope()

  readonly #assetId = ref<string>()
  readonly #asset = computed(() =>
    this.#assetId.value ? this.#editor.doc.assets.getAsset(this.#assetId.value) : undefined,
  )
  readonly #targetTrack = ref<{ id: string; before: boolean; left: number; top: number }>()
  readonly #dragOffsetPx = ref({ x: 0, y: 0 })
  readonly #dragCoords = ref({ x: 0, y: 0 })
  readonly #dragTime = computed(() => {
    const target = this.#targetTrack.value
    return target ? this.#editor.pixelsToSeconds(this.#dragOffsetPx.value.x) : 0
  })
  readonly #target = computed((): Target | undefined => {
    const { asset } = this
    const target = this.#targetTrack.value
    if (!asset || !target) return
    const track = this.#editor.doc.nodes.get(target.id) as pub.AnyTrack | undefined
    if (!track && !target.before) return

    const offsetS = this.#dragTime.value
    const foundIndex = target.before
      ? 0
      : track!.search((clip) => {
          const { start, duration } = clip.time
          return start + duration / 2 - offsetS
        })
    const index = foundIndex >= 0 ? foundIndex : -(foundIndex + 1) + 0
    const clipAtTarget = track?.children.at(index)
    const time = Math.max(
      0,
      target.before
        ? offsetS
        : clamp(
            offsetS,
            clipAtTarget ? (clipAtTarget.prev?.time.end ?? 0) : (track?.head?.time.end ?? 0),
            clipAtTarget?.time.start ?? Infinity,
          ),
    )
    const duration = asset.type === 'asset:media:av' ? asset.duration : DEFAULT_STILL_CLIP_DURATION_S

    return target.before
      ? { beforeTrackId: target.id, index, before: true, time, asset, duration }
      : { trackId: target.id, index, before: false, time, asset, duration }
  })

  get asset(): pub.AnyAsset | undefined {
    return this.#asset.value
  }
  get dragCoords(): pub.Schema.Point {
    return this.#dragCoords.value
  }
  get dragOffset() {
    return this.#dragOffsetPx.value
  }
  get dragTime() {
    return this.#dragTime.value
  }
  get target() {
    return this.#target.value
  }

  readonly #lastPointerWasDragged = ref(false)

  readonly #activeDropzoneElement = ref<Element>()
  get timelineHasDrag(): boolean {
    return !!this.#activeDropzoneElement.value
  }

  constructor(editor: pub.VideoEditor) {
    this.#editor = editor

    interact.dynamicDrop(true)

    this.#scope.run(() => {
      watch(
        [editor._editor._workspaceContainer, () => editor._editor.isMobileWorkspace],
        ([context, isMobile]) => {
          if (!context) return

          const draggable = interact('[data-asset-id]', { unique: true, context }).draggable({
            origin: context,
            manualStart: true,
            listeners: {
              start: this.#onAssetDragStart.bind(this),
              move: this.#onDragMove.bind(this),
              end: () => (this.#assetId.value = undefined),
            },
            max: 1,
          })

          draggable.on(['hold', 'move'], ({ interaction, currentTarget }: InteractPointerEvent) => {
            if (!interaction.interacting())
              interaction.start({ name: 'drag' } as any, draggable, currentTarget as HTMLElement)
          })

          if (isMobile) draggable.on('contextmenu', (event: Event) => event.preventDefault())

          const timelineDropzone = interact('[data-timeline-id]', { unique: true, context }).dropzone({
            accept: '[data-asset-id]',
            overlap: 'pointer',
            listeners: {
              enter: (event: DropEvent) => (this.#activeDropzoneElement.value = event.target),
              leave: () => (this.#activeDropzoneElement.value = undefined),
              move: this.#onDropMove.bind(this),
              deactivate: this.#onDropDeactivate.bind(this),
            },
          })

          const trackDropzone = interact('[data-track-id],[data-before-track-id]', {
            unique: true,
            context,
          }).dropzone({
            accept: '[data-asset-id]',
            overlap: 'pointer',
            listeners: {
              enter: this.#onDragEnter.bind(this),
              leave: this.#onTrackDragLeave.bind(this),
              move: this.#onDropMove.bind(this),
              deactivate: this.#onDropDeactivate.bind(this),
              drop: this.#onDrop.bind(this),
            },
          })

          onScopeDispose(() => {
            draggable.unset()
            timelineDropzone.unset()
            trackDropzone.unset()
            this.#assetId.value = this.#activeDropzoneElement.value = this.#targetTrack.value = undefined
          })
        },
      )

      useEventListener(
        window,
        'pointerdown',
        () => {
          this.#lastPointerWasDragged.value = false
        },
        { capture: true },
      )

      useEventListener(
        () => (this.#lastPointerWasDragged.value ? window : undefined),
        'click',
        (event) => {
          if (this.#lastPointerWasDragged.value) {
            event.preventDefault()
            event.stopImmediatePropagation()
          }
        },
        { capture: true },
      )
    })
  }

  #onAssetDragStart(event: DragEvent): void {
    const asset = this.#getAssetFromDragEvent(event)

    this.#lastPointerWasDragged.value = true

    if (!asset) {
      event.interaction.end()
      return
    }

    this.#assetId.value = asset.id

    // close asset mobile drawers
    event.target.closest('dialog')?.close()
  }

  #onDragMove(event: DragEvent): void {
    this.#dragCoords.value = event.client
  }

  #onDragEnter(event: DropEvent): void {
    this.#activeDropzoneElement.value = event.target
  }
  #onTrackDragLeave(): void {
    this.#activeDropzoneElement.value = undefined
    this.#targetTrack.value = undefined
  }

  #onDropMove(event: DropEvent): void {
    const coords = event.dragEvent.client
    const timelineElement = event.target.closest('[data-timeline-id]')
    const trackElement = event.target.matches('[data-track-id],[data-before-track-id]')
      ? event.target
      : undefined
    const { left, top } = timelineElement?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const targetTrack = this.#targetTrack

    this.#dragOffsetPx.value = { x: coords.x - left, y: coords.y - top }

    if (trackElement) {
      const { trackId, beforeTrackId } = trackElement.dataset
      const id = (trackId ?? '') || beforeTrackId

      const { asset } = this
      const track = id ? this.#editor.doc.nodes.get<pub.AnyTrack>(id) : undefined

      if (
        !track ||
        (asset &&
          (beforeTrackId ? true : track.isVideo() === asset.isVideo() || track.isAudio() === asset.isAudio()))
      ) {
        targetTrack.value = { id: id ?? '', before: !trackId, left, top }
      } else targetTrack.value = undefined
    } else {
      targetTrack.value = undefined
    }
  }

  #onDrop(): void {
    const target = this.#target.value
    if (!target) return

    const { asset } = target
    if (asset.type !== 'asset:media:av' && asset.type !== 'asset:media:image') return

    const editor = this.#editor
    const { doc } = editor

    let track

    if (target.before) {
      const beforeTrack = doc.nodes.get(target.beforeTrackId) as pub.AnyTrack | undefined

      track = doc.createNode({
        id: editor.generateId(),
        type: asset.isVideo() ? 'track:video' : 'track:audio',
      })
      track.move({ parentId: doc.timeline.id, index: beforeTrack?.index ?? doc.timeline.count })

      // always create linked audio tracks for video tracks
      // TODO: reconsider when improving linking UX
      if (track.isVideo()) {
        const audioTrack = doc.createNode({ id: editor.generateId(), type: 'track:audio' })
        doc.createLink({ id: editor.generateId(), nodes: [track, audioTrack] })
      }
    } else track = doc.nodes.get(target.trackId) as pub.AnyTrack | undefined

    if (!track) return

    const clip = doc.createNode(editor.createClipInitWithAsset(asset, track.isVideo() ? 'video' : 'audio'))

    moveAndFillGaps(
      clip,
      { parentId: track.id, index: target.index },
      Rational.fromDecimal(target.time, doc.frameRate),
    )

    // TODO: reconsider when improving linking UX
    if (asset.isVideo() && asset.isAudio() && track.link) {
      const audioClip = doc.createNode(editor.createClipInitWithAsset(asset, 'audio'))
      audioClip.move({ parentId: track.link.id, index: target.index })
      doc.createLink({ id: editor.generateId(), nodes: [clip, audioClip] })
    }

    editor.select(clip)
  }

  #onDropDeactivate(event: DropEvent): void {
    if (event.target === this.#activeDropzoneElement.value) this.#activeDropzoneElement.value = undefined
  }

  #getAssetFromDragEvent(event: DragEvent): pub.AnyAsset | undefined {
    const eventTarget = event.target
    const { assetId } = eventTarget.dataset
    return assetId ? this.#editor.doc.assets.getAsset(assetId) : undefined
  }

  dispose(): void {
    this.#scope.stop()
    this.#activeDropzoneElement.value = this.#targetTrack.value = undefined
    this.#editor = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
