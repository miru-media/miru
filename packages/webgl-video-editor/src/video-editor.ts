import { computed, ref, type Ref } from 'fine-jsx'
import { uid } from 'uid'
import { Renderer as EffectRenderer, type ExportResult } from 'webgl-effects'

import type { Size } from 'shared/types'
import { useElementSize } from 'shared/utils/composables.ts'
import { remap0 } from 'shared/utils/math'

import type { AnyClip, AnyNode, AnyTrackChild, NodeSnapshot } from '../types/internal'
import type { AnyNodeSerializedSchema } from '../types/schema'
import type * as pub from '../types/webgl-video-editor'

import { MIN_CLIP_DURATION_S } from './constants.ts'
import { type NodeDeleteEvent, NodeMoveEvent, NodeUpdateEvent } from './events.ts'
import { ExporterDocument } from './export/exporter-document.ts'
import {
  type BaseClip,
  type BaseNode,
  MediaAsset,
  PlaybackDocument,
  type Schema,
  type Track,
  type VideoEffectAsset,
} from './nodes/index.ts'

const getClipAtTime = (track: Track, time: number): AnyClip | undefined => {
  for (let clip = track.firstClip; clip; clip = clip.nextClip) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip as AnyClip
  }
}

const INITIAL_SECONDS_PER_PIXEL = 0.01

type DragResizeInitialState = [
  prev: NodeSnapshot<Schema.AnyClip> | undefined,
  cur: NodeSnapshot<Schema.AnyClip>,
  next: NodeSnapshot<Schema.AnyClip> | undefined,
]

export class VideoEditor {
  readonly _editor = this

  _doc!: PlaybackDocument
  readonly store?: pub.VideoEditorStore

  readonly #selection = ref<AnyTrackChild>()
  _secondsPerPixel = ref(INITIAL_SECONDS_PER_PIXEL)
  _timelineSize = ref<Size>({ width: 1, height: 1 })
  _viewportSize: Ref<Size>
  _zoom = computed(() => this.viewportSize.width / this._doc.resolution.width)

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

  get canvas(): HTMLCanvasElement {
    return this._doc.canvas
  }
  get currentTime(): number {
    return this._doc.currentTime
  }

  get state(): Schema.SerializedDocument {
    return this.toObject()
  }

  readonly #effects = computed(
    () =>
      new Map(
        Array.from(this._doc.assets.values())
          .filter((asset) => asset.type === 'asset:effect:video')
          .map((effect) => [effect.id, effect]),
      ),
  )
  get effects(): Map<string, VideoEffectAsset> {
    return this.#effects.value
  }

  _showStats = ref(false)

  readonly #exportResult = ref<ExportResult>()
  get exportResult(): ExportResult | undefined {
    return this.#exportResult.value
  }

  readonly #exportProgress = ref(-1)
  get exportProgress(): number {
    return this.#exportProgress.value
  }

  get selection(): AnyTrackChild | undefined {
    return this.#selection.value
  }

  get tracks(): Track[] {
    return this._doc.timeline.children
  }

  get viewportSize(): Size {
    return this._viewportSize.value
  }

  get zoom(): number {
    return this._zoom.value
  }

  constructor(options: { store?: pub.VideoEditorStore }) {
    const { store } = options

    this._doc = new PlaybackDocument()
    this.store = store

    this.effectRenderer = new EffectRenderer()

    if (store) store.init(this as unknown as pub.VideoEditor)

    this._doc.on('node:delete', ({ node }: NodeDeleteEvent) => {
      if (node.id === this.selection?.id) this.select(undefined)
    })

    this._doc.on('canvas:pointerdown', ({ node }) => this.select(node?.id))

    this._viewportSize = useElementSize(this.canvas)
  }

  generateId(): string {
    const { store } = this
    return store ? store.generateId() : uid()
  }

  importJson(content: Schema.SerializedDocument): void {
    this._doc.importFromJson(content)
  }

  async createMediaAsset(source: string | Blob): Promise<MediaAsset> {
    const init = await MediaAsset.getAvMediaAssetInfo(this.generateId(), source)
    return new MediaAsset(init, { root: this._doc, source })
  }

  async addClip(track: Track, source: string | Blob | Schema.AnyClip): Promise<AnyClip> {
    let init: Schema.BaseClip
    let newAssetData: { init: Schema.AvMediaAsset; source: string | Blob } | undefined

    if (typeof source === 'string' || source instanceof Blob) {
      const assetId = this.generateId()
      const assetInit = await MediaAsset.getAvMediaAssetInfo(assetId, source)
      const { duration } = assetInit

      newAssetData = {
        init: assetInit,
        source,
      }

      init = {
        id: this.generateId(),
        type: 'clip',
        clipType: track.trackType,
        source: { assetId },
        sourceStart: 0,
        duration,
      }
    } else {
      init = source
    }

    return this._transact(() => {
      if (newAssetData)
        void new MediaAsset(newAssetData.init, { root: this._doc, source: newAssetData.source })

      const clip = this._doc.createNode(init)

      clip.treePosition({ parentId: track.id, index: track.count })

      return clip
    })
  }

  async replaceClipSource(source: string | Blob): Promise<void> {
    const clip = this.#selection.value
    if (!clip?.isClip()) return

    const init = await MediaAsset.getAvMediaAssetInfo(this.generateId(), source)

    this._transact(() => {
      const asset = new MediaAsset(init, { root: this._doc, source })

      clip.duration = Math.min(asset.duration, clip.duration)
      clip.sourceAsset = asset
    })
  }

  splitClipAtCurrentTime(): AnyClip | undefined {
    const { currentTime } = this._doc
    const trackOfSelectedClip = this.#selection.value?.parent

    // first search the track that contains a selected clip
    let clip = trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)

    if (!clip) {
      // then search all tracks for a clip at the current time
      for (const track of this._doc.timeline.children) {
        clip = getClipAtTime(track, currentTime)
        if (clip) break
      }
    }

    if (!clip?.parent) return

    const { parent } = clip
    const prevClipTime = clip.time
    const delta = currentTime - prevClipTime.start

    if (delta < MIN_CLIP_DURATION_S) return

    return this._transact((): AnyClip => {
      const startClip = this._doc.createNode({
        ...clip.toObject(),
        id: this.generateId(),
        transition: undefined,
        duration: delta,
      })
      const endClip = this._doc.createNode({
        ...clip.toObject(),
        id: this.generateId(),
        sourceStart: prevClipTime.source + delta,
        duration: prevClipTime.duration - delta,
      })

      startClip.treePosition({ parentId: parent.id, index: clip.index })
      endClip.treePosition({ parentId: parent.id, index: clip.index + 1 })

      this.#select(startClip, false)
      clip.dispose()

      return endClip
    })
  }

  addTrack(trackType: 'video' | 'audio'): Track {
    const doc = this._doc

    return this._transact(() => {
      const track = doc.createNode({ id: this.generateId(), trackType, type: 'track' })
      track.treePosition({ parentId: doc.timeline.id, index: doc.timeline.count })
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
    this._doc.play()
  }
  pause(): void {
    this._doc.pause()
  }
  seekTo(time: number): void {
    this._doc.seekTo(time)
  }

  select(id: string | undefined, seek = true): void {
    this.#select(id ? this._doc.nodes.get<AnyTrackChild>(id) : undefined, seek)
  }
  #select(clip: AnyTrackChild | undefined, seek: boolean): void {
    this.#selection.value = clip

    if (clip && seek) {
      const { start, end } = clip.time
      const { _doc: doc } = this

      if (doc.currentTime < start) doc.seekTo(start)
      else if (doc.currentTime >= end) doc.seekTo(end - 1 / doc.frameRate)
    }
  }

  _startClipDrag(clip: AnyClip): void {
    this._drag.isDragging.value = true
    this._drag.from = [clip.prevClip?.getSnapshot(), clip.getSnapshot(), clip.nextClip?.getSnapshot()]
  }
  _endClipDrag(): void {
    const { isDragging, x, from } = this._drag
    isDragging.value = false

    from && this.emitDragResizeChange(from)

    x.value = 0
  }

  _startClipResize(clip: BaseClip): void {
    const doc = this._doc
    doc.pause()

    this._resize.value = {
      docDuration: doc.duration,
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
    const root = this._doc

    this._transact(() => {
      for (const from of states) {
        if (!from) continue
        const node = root.nodes.get(from.node.id)

        root._emit(new NodeUpdateEvent(node, from.node))

        if (node.parent?.id !== from.position?.parentId) root._emit(new NodeMoveEvent(node, from.position))
      }
    })
  }

  _untracked<T>(fn: () => T): T {
    return this.store ? this.store.untracked(fn) : fn()
  }

  _transact<T>(fn: () => T): T {
    return this.store ? this.store.transact(fn) : fn()
  }

  secondsToPixels(time: number): number {
    const timelineWidth = this._timelineSize.value.width
    return remap0(time, timelineWidth * this._secondsPerPixel.value, timelineWidth)
  }

  pixelsToSeconds(offset: number): number {
    return offset * this._secondsPerPixel.value
  }

  toObject(): Schema.SerializedDocument {
    const serialize = <T extends Schema.AnyNodeSchema | Schema.AnyAsset>(
      node: Extract<AnyNode, BaseNode<T>>,
    ): Extract<AnyNodeSerializedSchema, { type: T['type'] }> => {
      if ('children' in node && node.children != null) {
        const serialized = {
          ...node.toObject(),
          children: node.children.map(serialize as any),
        }
        return serialized as any
      }

      return node.toObject() as any
    }

    const { assets: _assets, timeline } = this._doc

    return {
      ...this._doc.toObject(),
      assets: Array.from(_assets.values()).map(serialize as any),
      tracks: timeline.children.map(serialize),
    }
  }

  async export(): Promise<{ blob: Blob; url: string } | undefined> {
    this.#exportResult.value = undefined

    const onProgress = (value: number): void => void (this.#exportProgress.value = value)

    this._doc.pause()
    onProgress(0)

    try {
      const exporter = new ExporterDocument(this._doc)

      await this._doc
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
    this._doc.dispose()
  }
}
