import { computed, ref } from 'fine-jsx'
import { uid } from 'uid'
import type { ExportResult, Renderer } from 'webgl-effects'

import type { Size } from 'shared/types'
import { remap0 } from 'shared/utils/math'
import { assertCanDecodeMediaFile, hasVideoDecoder } from 'shared/video/utils'

import type { AnyNode, NodeSnapshot } from '../types/internal'
import type { AnyNodeSerializedSchema } from '../types/schema'
import type * as pub from '../types/webgl-video-editor'

import { MIN_CLIP_DURATION_S } from './constants.ts'
import { type NodeDeleteEvent, NodeMoveEvent, NodeUpdateEvent } from './events.ts'
import { ExporterMovie } from './export/exporter-movie.ts'
import {
  type BaseClip,
  type BaseNode,
  Clip,
  MediaAsset,
  Movie,
  type Schema,
  type Track,
  type VideoEffectAsset,
} from './nodes/index.ts'

const getClipAtTime = (track: Track, time: number) => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip as Clip
  }
}

const INITIAL_SECONDS_PER_PIXEL = 0.01

type DragResizeInitialState = [
  prev: NodeSnapshot<Schema.Clip> | undefined,
  cur: NodeSnapshot<Schema.Clip>,
  next: NodeSnapshot<Schema.Clip> | undefined,
]

export class VideoEditor {
  readonly _editor = this

  _movie!: Movie
  readonly store?: pub.VideoEditorStore

  readonly #selection = ref<Clip>()
  _secondsPerPixel = ref(INITIAL_SECONDS_PER_PIXEL)
  _timelineSize = ref<Size>({ width: 1, height: 1 })

  _resize = ref<{
    movieDuration: number
    from: DragResizeInitialState
  }>()
  _drag = {
    from: undefined as DragResizeInitialState | undefined,
    isDragging: ref(false),
    x: ref(0),
  }

  get effectRenderer(): Renderer {
    return this._movie.effectRenderer
  }
  get canvas(): HTMLCanvasElement {
    return this._movie.canvas
  }
  get currentTime(): number {
    return this._movie.currentTime
  }

  get state(): Schema.SerializedMovie {
    return this.toObject()
  }

  readonly #effects = computed(
    () =>
      new Map(
        Array.from(this._movie.assets.values())
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

  get selection(): Clip | undefined {
    return this.#selection.value
  }

  get tracks(): Track[] {
    return this._movie.timeline.children
  }

  constructor(options: { store?: pub.VideoEditorStore }) {
    const { store } = options

    this._movie = new Movie()
    this.store = store

    if (store) store.init(this as unknown as pub.VideoEditor)

    this._movie.on('node:delete', ({ node }: NodeDeleteEvent) => {
      if (node.id === this.selection?.id) this.selectClip(undefined)
    })
  }

  generateId(): string {
    const { store } = this
    return store ? store.generateId() : uid()
  }

  importJson(content: Schema.SerializedMovie): void {
    this._movie.importFromJson(content)
  }

  async createMediaAsset(source: string | Blob): Promise<MediaAsset> {
    const init = await MediaAsset.getAvMediaAssetInfo(this.generateId(), source)
    return new MediaAsset(init, { root: this._movie, source })
  }

  async addClip(track: Track, source: string | Blob | Schema.Clip): Promise<Clip> {
    let init: Schema.Clip
    let newAssetData: { init: Schema.AvMediaAsset; source: string | Blob } | undefined

    if (typeof source === 'string' || source instanceof Blob) {
      if (track.trackType === 'audio' && hasVideoDecoder()) await assertCanDecodeMediaFile(source)
      const assetId = this.generateId()
      const assetInit = await MediaAsset.getAvMediaAssetInfo(assetId, source)
      const { duration } = assetInit

      newAssetData = {
        init: assetInit,
        source,
      }

      init = { id: this.generateId(), type: 'clip', source: { assetId }, sourceStart: 0, duration }
    } else {
      init = source
    }

    return this._transact(() => {
      if (newAssetData)
        void new MediaAsset(newAssetData.init, { root: this._movie, source: newAssetData.source })

      const clip = new Clip(init, this._movie)

      clip.position({ parentId: track.id, index: track.count })

      return clip
    })
  }

  async replaceClipSource(source: string | Blob): Promise<void> {
    const clip = this.#selection.value
    if (!clip) return

    const init = await MediaAsset.getAvMediaAssetInfo(this.generateId(), source)

    this._transact(() => {
      const asset = new MediaAsset(init, { root: this._movie, source })

      clip.duration = Math.min(asset.duration, clip.duration)
      clip.sourceAsset = asset
    })
  }

  splitClipAtCurrentTime(): Clip | undefined {
    const { currentTime } = this._movie
    const trackOfSelectedClip = this.#selection.value?.parent

    // first search the track that contains a selected clip
    let clip = trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)

    if (!clip) {
      // then search all tracks for a clip at the current time
      for (const track of this._movie.timeline.children) {
        clip = getClipAtTime(track, currentTime)
        if (clip) break
      }
    }

    if (!clip?.parent) return

    const { parent } = clip
    const prevClipTime = clip.time
    const delta = currentTime - prevClipTime.start

    if (delta < MIN_CLIP_DURATION_S) return

    return this._transact((): Clip => {
      const startClip = new Clip(
        {
          ...clip.toObject(),
          id: this.generateId(),
          transition: undefined,
          duration: delta,
        },
        this._movie,
      )
      const endClip = new Clip(
        {
          ...clip.toObject(),
          id: this.generateId(),
          sourceStart: prevClipTime.source + delta,
          duration: prevClipTime.duration - delta,
        },
        this._movie,
      )

      startClip.position({ parentId: parent.id, index: clip.index })
      endClip.position({ parentId: parent.id, index: clip.index + 1 })

      this.#selectClip(startClip, false)
      clip.dispose()

      return endClip
    })
  }

  addTrack(type: 'video' | 'audio'): Track {
    const movie = this._movie

    return this._transact(() => {
      const track = movie.createNode({ id: this.generateId(), trackType: type, type: 'track' })
      track.position({ parentId: movie.timeline.id, index: movie.count })
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
    this._movie.play()
  }
  pause(): void {
    this._movie.pause()
  }
  seekTo(time: number): void {
    this._movie.seekTo(time)
  }

  selectClip(id: string | undefined, seek = true): void {
    this.#selectClip(id ? this._movie.nodes.get<Clip>(id) : undefined, seek)
  }
  #selectClip(clip: Clip | undefined, seek: boolean): void {
    this.#selection.value = clip

    if (clip && seek) {
      const { start, end } = clip.time
      const { _movie: movie } = this

      if (movie.currentTime < start) movie.seekTo(start)
      else if (movie.currentTime >= end) movie.seekTo(end - 1 / movie.frameRate)
    }
  }

  _startClipDrag(clip: Clip): void {
    this._drag.isDragging.value = true
    this._drag.from = [clip.prev?.getSnapshot(), clip.getSnapshot(), clip.next?.getSnapshot()]
  }
  _endClipDrag(): void {
    const { isDragging, x, from } = this._drag
    isDragging.value = false

    from && this.emitDragResizeChange(from)

    x.value = 0
  }

  _startClipResize(clip: BaseClip): void {
    const { _movie: movie } = this
    movie.pause()

    this._resize.value = {
      movieDuration: movie.duration,
      from: [clip.prev?.getSnapshot(), clip.getSnapshot(), clip.next?.getSnapshot()],
    }
  }
  _endClipResize(): void {
    const resize = this._resize.value
    if (!resize) return

    this.emitDragResizeChange(resize.from)

    this._resize.value = undefined
  }

  emitDragResizeChange(states: DragResizeInitialState) {
    const root = this._movie

    this._transact(() => {
      for (const from of states) {
        if (!from) continue
        const node = root.nodes.get(from.id)

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

  toObject(): Schema.SerializedMovie {
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

    const { assets: _assets, timeline } = this._movie

    return {
      ...this._movie.toObject(),
      assets: Array.from(_assets.values()).map(serialize as any),
      tracks: timeline.children.map(serialize),
    }
  }

  async export(): Promise<{ blob: Blob; url: string } | undefined> {
    this.#exportResult.value = undefined

    const onProgress = (value: number): void => void (this.#exportProgress.value = value)

    this._movie.pause()
    onProgress(0)

    try {
      const exporter = new ExporterMovie(this._movie)

      await this._movie
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
    this._movie.dispose()
  }
}
