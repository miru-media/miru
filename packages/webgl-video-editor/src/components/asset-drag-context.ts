import { computed, ref } from 'fine-jsx'

import { ASSET_REF_MIME_TYPE, DEFAULT_STILL_CLIP_DURATION_S } from '#constants'
import type * as pub from '#core'
import { clamp, Rational } from 'shared/utils/math.ts'

import { moveAndFillGaps, useDomDropzone } from './utils.ts'

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

const ASSET_DRAG_THUMBNAIL_OFFSET_PX = 16
const THUMBNAIL_ATTR = 'data-asset-drag-thumbnail'

export class AssetDragContext {
  #editor: pub.VideoEditor
  readonly #assetId = ref<string>()
  readonly #asset = computed(() =>
    this.#assetId.value ? this.#editor.doc.assets.getAsset(this.#assetId.value) : undefined,
  )
  readonly #targetTrack = ref<{ id: string; before: boolean; left: number; top: number }>()
  readonly #dragOffsetPx = ref({ x: 0, y: 0 })
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
  readonly #dropzone: ReturnType<typeof useDomDropzone>

  get asset(): pub.AnyAsset | undefined {
    return this.#asset.value
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
  get timelineHasDrag(): boolean {
    return this.#dropzone.hasDrag.value
  }

  onDelegatedDragStart = this.#onDelegatedDragStart.bind(this)
  THUMBNAIL_ATTR = THUMBNAIL_ATTR

  constructor(editor: pub.VideoEditor) {
    this.#editor = editor

    this.#dropzone = useDomDropzone(editor._editor._timelineContainer, {
      filter: (item) => item.type.startsWith(ASSET_REF_MIME_TYPE),
      onDragOver: (event: DragEvent) => {
        const trackElement = (event.target as HTMLElement).closest<HTMLElement>(
          '[data-track-id],[data-before-track-id]',
        )
        const { left, top } = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const targetTrack = this.#targetTrack

        this.#dragOffsetPx.value = { x: event.clientX - left, y: event.clientY - top }

        if (trackElement) {
          const { trackId, beforeTrackId } = trackElement.dataset
          const id = (trackId ?? '') || beforeTrackId

          const { asset } = this
          const track = id ? this.#editor.doc.nodes.get<pub.AnyTrack>(id) : undefined

          if (
            !track ||
            (asset &&
              (beforeTrackId
                ? true
                : track.isVideo() === asset.isVideo() || track.isAudio() === asset.isAudio()))
          ) {
            targetTrack.value = { id: id ?? '', before: !trackId, left, top }
          } else targetTrack.value = undefined
        } else {
          targetTrack.value = undefined
        }
      },
      onLeave: () => {
        this.#targetTrack.value = undefined
      },
      onDrop: () => {
        const target = this.#target.value
        if (!target) return

        const { asset } = target
        if (asset.type !== 'asset:media:av' && asset.type !== 'asset:media:image') return

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

        const clip = doc.createNode(
          editor.createClipInitWithAsset(asset, track.isVideo() ? 'video' : 'audio'),
        )

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
      },
      onDragEnd: () => {
        this.#targetTrack.value = this.#assetId.value = undefined
      },
    })
  }

  #onDelegatedDragStart(event: DragEvent): void {
    const { dataTransfer } = event
    if (!dataTransfer) return

    const eventTarget = event.target as HTMLElement
    const assetElement = eventTarget.closest<HTMLElement>('[data-asset-id]')
    this.#assetId.value = assetElement?.dataset.assetId
    const { asset } = this
    if (!asset) return

    // close asset mobile drawers
    eventTarget.closest('dialog')?.close()

    dataTransfer.setData(ASSET_REF_MIME_TYPE, asset.id)

    const thumbnail = eventTarget.closest(`[${THUMBNAIL_ATTR}]`)
    if (thumbnail)
      dataTransfer.setDragImage(thumbnail, -ASSET_DRAG_THUMBNAIL_OFFSET_PX, -ASSET_DRAG_THUMBNAIL_OFFSET_PX)
  }

  dispose(): void {
    this.#editor = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
