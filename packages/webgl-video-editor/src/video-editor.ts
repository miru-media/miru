import { computed, ref, type Ref } from 'fine-jsx'
import { uid } from 'uid'
import { Renderer as EffectRenderer, type ExportResult } from 'webgl-effects'

import type { NodeSnapshot } from '#internal'
import type * as Schema from '#schema'
import type { Size } from 'shared/types'
import { IS_FIREFOX } from 'shared/userAgent.ts'
import { useElementSize } from 'shared/utils/composables.ts'
import { getWebgl2Context } from 'shared/utils/images.ts'
import { remap0 } from 'shared/utils/math'

import type * as pub from '../types/webgl-video-editor'

import { MIN_CLIP_DURATION_S } from './constants.ts'
import { ExportDocumentView } from './document-views/export/exporter-document.ts'
import { PlaybackDocument } from './document-views/playback/playback-document.ts'
import { RenderDocument } from './document-views/render/render-document.ts'
import { Document } from './document.ts'
import { type NodeDeleteEvent, NodeMoveEvent, NodeUpdateEvent } from './events.ts'

const getClipAtTime = (track: pub.Track, time: number): pub.AnyClip | undefined => {
  for (let clip = track.firstClip; clip; clip = clip.nextClip) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip
  }
}

const INITIAL_SECONDS_PER_PIXEL = 0.01

type DragResizeInitialState = [
  prev: NodeSnapshot<Schema.AnyClip> | undefined,
  cur: NodeSnapshot<Schema.AnyClip>,
  next: NodeSnapshot<Schema.AnyClip> | undefined,
]

export class VideoEditor implements pub.VideoEditor {
  doc!: pub.Document
  readonly sync?: pub.VideoEditorDocumentSync

  readonly #selection = ref<pub.AnyTrackChild>()
  _secondsPerPixel = ref(INITIAL_SECONDS_PER_PIXEL)
  _timelineSize = ref<Size>({ width: 1, height: 1 })
  _viewportSize: Ref<Size>
  _zoom = computed(() => this.viewportSize.width / this.doc.resolution.width)

  _resize = ref<{
    docDuration: number
    from: DragResizeInitialState
  }>()
  _drag = {
    from: undefined as DragResizeInitialState | undefined,
    isDragging: ref(false),
    x: ref(0),
  }

  effectRenderer: EffectRenderer
  playback: PlaybackDocument

  canvas = document.createElement('canvas')
  isDisposed = false

  get isPaused(): boolean {
    return this.playback.isPaused
  }

  get currentTime(): number {
    return this.doc.currentTime
  }

  get state(): Schema.SerializedDocument {
    return this.toObject()
  }

  readonly #effects = computed(
    () =>
      new Map(
        Array.from(this.doc.assets.values())
          .filter((asset) => asset.type === 'asset:effect:video')
          .map((effect) => [effect.id, effect]),
      ),
  )
  get effects(): Map<string, pub.VideoEffectAsset> {
    return this.#effects.value
  }

  readonly #showStats = ref(false)
  get _showStats(): boolean {
    return this.#showStats.value
  }
  set _showStats(value) {
    this.#showStats.value = value
  }

  readonly #exportResult = ref<ExportResult>()
  get exportResult(): ExportResult | undefined {
    return this.#exportResult.value
  }

  readonly #exportProgress = ref(-1)
  get exportProgress(): number {
    return this.#exportProgress.value
  }

  get selection(): pub.AnyTrackChild | undefined {
    return this.#selection.value
  }

  get tracks(): pub.Track[] {
    return this.doc.timeline.children
  }

  get viewportSize(): Size {
    return this._viewportSize.value
  }

  get zoom(): number {
    return this._zoom.value
  }

  constructor(options: { sync?: pub.VideoEditorDocumentSync; assets?: pub.VideoEditorAssetStore } = {}) {
    const { sync, assets } = options
    const doc = (this.doc = new Document({ assets }))

    this.sync = sync

    const renderView = new RenderDocument({
      doc,
      applyVideoRotation: IS_FIREFOX,
      gl: getWebgl2Context(this.canvas, { stencil: true }),
    })
    this.playback = new PlaybackDocument({ renderView })

    this.effectRenderer = new EffectRenderer()

    if (sync) sync.init(this)

    this.doc.on('node:delete', ({ node }: NodeDeleteEvent) => {
      if (node.id === this.selection?.id) this.select(undefined)
    })

    this.doc.on('canvas:pointerdown', ({ node }) => this.select(node))

    this._viewportSize = useElementSize(this.canvas)
  }

  generateId(): string {
    const { sync } = this
    return sync ? sync.generateId() : uid()
  }

  importJson(content: Schema.SerializedDocument): void {
    this.doc.importFromJson(content)
  }

  async createMediaAsset(source: string | Blob): Promise<pub.MediaAsset> {
    return await this.doc.assets.createMediaAsset(source)
  }

  addClip(track: pub.Track, asset: pub.MediaAsset): pub.AnyClip {
    let newAssetData: { init: Schema.MediaAsset; source: string | Blob } | undefined

    const { duration } = asset

    const init: Schema.AnyClip = {
      id: this.generateId(),
      type: 'clip',
      clipType: track.trackType,
      sourceRef: { assetId: asset.id },
      sourceStart: 0,
      duration,
    }

    return this._transact(() => {
      if (newAssetData) this.doc.assets.create(newAssetData.init, { source: newAssetData.source })

      const clip = this.doc.createNode(init)

      clip.move({ parentId: track.id, index: track.clipCount })

      return clip
    })
  }

  replaceClipAsset(asset: pub.MediaAsset): void {
    const clip = this.#selection.value
    if (!clip?.isClip()) return

    this._transact(() => {
      clip.duration = Math.min(asset.duration, clip.duration)
      clip.sourceRef = { assetId: asset.id }
    })
  }

  splitClipAtCurrentTime(): [pub.AnyClip, pub.AnyClip] | undefined {
    const { currentTime } = this.doc
    const trackOfSelectedClip = this.#selection.value?.parent

    // first search the track that contains a selected clip
    let clip = trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)

    if (!clip) {
      // then search all tracks for a clip at the current time
      for (const track of this.doc.timeline.children) {
        clip = getClipAtTime(track, currentTime)
        if (clip) break
      }
    }

    if (!clip?.parent) return

    const { parent } = clip
    const prevClipTime = clip.time
    const delta = currentTime - prevClipTime.start

    if (delta < MIN_CLIP_DURATION_S) return

    return this._transact(() => {
      const startClip = this.doc.createNode({
        ...clip.toObject(),
        id: this.generateId(),
        transition: undefined,
        duration: delta,
      })
      const endClip = this.doc.createNode({
        ...clip.toObject(),
        id: this.generateId(),
        sourceStart: prevClipTime.source + delta,
        duration: prevClipTime.duration - delta,
      })

      startClip.move({ parentId: parent.id, index: clip.index })
      endClip.move({ parentId: parent.id, index: clip.index + 1 })

      this.#select(startClip, false)
      clip.dispose()

      return [startClip, endClip]
    })
  }

  addTrack(trackType: 'video' | 'audio'): pub.Track {
    const { doc } = this

    return this._transact(() => {
      const track = doc.createNode({ id: this.generateId(), trackType, type: 'track' })
      track.move({ parentId: doc.timeline.id, index: doc.timeline.trackCount })
      return track
    })
  }

  deleteSelection(): void {
    const clip = this.#selection.value
    if (!clip) return

    this.#selection.value = undefined

    this._transact(() => clip.dispose())
  }

  play(): void {
    this.playback.play()
  }
  pause(): void {
    this.playback.pause()
  }
  seekTo(time: number): void {
    this.doc.seekTo(time)
  }

  select(clip: pub.AnyTrackChild | undefined, seek = true): void {
    this.#select(clip, seek)
  }
  #select(clip: pub.AnyTrackChild | undefined, seek: boolean): void {
    this.#selection.value = clip

    if (clip && seek) {
      const { start, end } = clip.time
      const { doc } = this

      if (doc.currentTime < start) doc.seekTo(start)
      else if (doc.currentTime >= end) doc.seekTo(end - 1 / doc.frameRate)
    }
  }

  _startClipDrag(clip: pub.AnyClip): void {
    this._drag.isDragging.value = true
    this._drag.from = [clip.prevClip?.getSnapshot(), clip.getSnapshot(), clip.nextClip?.getSnapshot()]
  }
  _endClipDrag(): void {
    const { isDragging, x, from } = this._drag
    isDragging.value = false

    from && this.emitDragResizeChange(from)

    x.value = 0
  }

  _startClipResize(clip: pub.AnyClip): void {
    this.playback.pause()

    this._resize.value = {
      docDuration: this.doc.duration,
      from: [clip.prevClip?.getSnapshot(), clip.getSnapshot(), clip.nextClip?.getSnapshot()],
    }
  }
  _endClipResize(): void {
    const resize = this._resize.value
    if (!resize) return

    this.emitDragResizeChange(resize.from)

    this._resize.value = undefined
  }

  emitDragResizeChange(states: DragResizeInitialState) {
    const { doc } = this

    this._transact(() => {
      for (const from of states) {
        if (!from) continue
        const node = doc.nodes.get(from.node.id)

        doc.emit(new NodeUpdateEvent(node, from.node))

        if (node.parent?.id !== from.position?.parentId) doc.emit(new NodeMoveEvent(node, from.position))
      }
    })
  }

  _untracked<T>(fn: () => T): T {
    return this.sync ? this.sync.untracked(fn) : fn()
  }

  _transact<T>(fn: () => T): T {
    return this.sync ? this.sync.transact(fn) : fn()
  }

  secondsToPixels(time: number): number {
    const timelineWidth = this._timelineSize.value.width
    return remap0(time, timelineWidth * this._secondsPerPixel.value, timelineWidth)
  }

  pixelsToSeconds(offset: number): number {
    return offset * this._secondsPerPixel.value
  }

  toObject(): Schema.SerializedDocument {
    const serialize = <T extends (Schema.AnyNodeSchema | Schema.AnyAssetSchema)['type']>(
      node: Extract<pub.AnyNode | pub.AnyAsset, { type: T }>,
    ): Extract<Schema.AnyNodeSerializedSchema | Schema.AnyAssetSchema, T> => {
      if ('children' in node) {
        const serialized = {
          ...node.toObject(),
          children: node.children.map(serialize as any),
        }
        return serialized as any
      }

      return node.toObject()
    }

    const { assets: _assets, timeline, resolution, frameRate } = this.doc

    return {
      resolution,
      frameRate,
      assets: Array.from(_assets.values()).map(serialize),
      tracks: timeline.children.map(serialize),
    }
  }

  async export(): Promise<{ blob: Blob; url: string } | undefined> {
    this.#exportResult.value = undefined

    const onProgress = (value: number): void => void (this.#exportProgress.value = value)

    this.playback.pause()
    onProgress(0)

    try {
      const exporter = new ExportDocumentView({ doc: this.doc, renderOptions: this.playback.renderView })

      await this.playback
        .withoutRendering(async () => {
          const blob = await exporter.start({ onProgress })
          this.#exportResult.value = { blob, url: URL.createObjectURL(blob) }
        })
        .finally(() => exporter.dispose())
    } catch (error) {
      // eslint-disable-next-line no-alert -- TODO
      alert(`Encountered an error while exporting: ${String(error)}`)
    } finally {
      this.#exportProgress.value = -1
    }

    return this.exportResult
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    this.playback.renderView.dispose()
    this.playback.dispose()
    this.doc.dispose()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
