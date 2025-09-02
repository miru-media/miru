import { computed, ref } from 'fine-jsx'
import { uid } from 'uid'
import { type ExportResult, getDefaultFilterDefinitions, type Renderer } from 'webgl-effects'

import type { Size } from 'shared/types'
import { remap0 } from 'shared/utils/math'
import { assertCanDecodeMediaFile, hasVideoDecoder } from 'shared/video/utils'

import type { AnyNode, NodeSnapshot } from '../types/internal'
import type { AnyNodeSerializedSchema } from '../types/schema'
import type * as pub from '../types/webgl-video-editor'

import { MIN_CLIP_DURATION_S } from './constants.ts'
import { MovieReplaceEvent, NodeMoveEvent, NodeUpdateEvent } from './events.ts'
import { MovieExporter } from './export/movie-exporter.ts'
import {
  type BaseClip,
  type BaseNode,
  Clip,
  Collection,
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

  get renderer(): Renderer {
    return this._movie.renderer
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
        this._movie.assetLibrary.children
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

  readonly #isLoading = ref(0)

  get selection(): Clip | undefined {
    return this.#selection.value
  }
  get isLoading(): boolean {
    return this.#isLoading.value > 0
  }

  get tracks(): Track[] {
    return this._movie.timeline.children
  }

  constructor(options: { store?: pub.VideoEditorStore }) {
    const { store } = options

    this._movie = new Movie()
    this.store = store

    if (store) store.init(this as unknown as pub.VideoEditor)

    this._movie.on('node:delete', ({ nodeId }) => {
      if (nodeId === this.selection?.id) this.selectClip(undefined)
    })
  }

  createInitialAssets(): void {
    const { assetLibrary } = this._movie

    getDefaultFilterDefinitions()
      .map(
        (def, index): Schema.VideoEffectAsset => ({
          ...def,
          id: `${this.generateId()}-${def.id ?? index.toString()}`,
          type: 'asset:effect:video',
        }),
      )
      .forEach((init) => {
        const asset = this._movie.createNode(init)
        asset.position({ parentId: assetLibrary.id, index: assetLibrary.count })
      })
  }

  async #withLoading<T>(fn: () => Promise<T>): Promise<T> {
    this.#isLoading.value++
    return await fn().finally(() => this.#isLoading.value--)
  }

  async clearAllContentAndHistory(): Promise<void> {
    await this.#withLoading(async () => {
      const { _movie: movie } = this

      this._transact(() => {
        this.selectClip(undefined)
        movie.clearAllContent()
      })

      await MediaAsset.clearCache().then(() => undefined)

      this._transact(() => {
        this.createInitialAssets()
        this._movie._emit(new MovieReplaceEvent())
      })
    })
  }

  generateId(): string {
    const { store } = this
    return store ? store.generateId() : uid()
  }

  replaceContent(movieInit: Schema.SerializedMovie): void {
    const { _movie: movie } = this

    movie.clearAllContent()
    movie.resolution = movieInit.resolution
    movie.frameRate = movieInit.frameRate

    movie.children.forEach((collection) => collection.dispose())

    const createChildren = (node: AnyNode, init: Schema.AnyNodeSerializedSchema): void => {
      if ('children' in init) {
        init.children.forEach((childInit, index) => {
          const childNode = movie.createNode(childInit)
          childNode.position({ parentId: node.id, index })
          createChildren(childNode, childInit)
        })
      }
    }

    createChildren(movie, movieInit)

    const missingCollections = new Set([Collection.ASSET_LIBRARY, Collection.TIMELINE] as const)
    movieInit.children.forEach(({ kind }) => missingCollections.delete(kind))
    missingCollections.forEach((kind) =>
      movie.createNode({ id: this.generateId(), type: 'collection', kind }),
    )

    this._movie._emit(new MovieReplaceEvent())
  }

  async createMediaAsset(source: string | Blob): Promise<MediaAsset> {
    const init = await MediaAsset.getAvMediaAssetInfo(this.generateId(), source)
    return MediaAsset.fromInit(init, this._movie, source)
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
      if (newAssetData) MediaAsset.fromInit(newAssetData.init, this._movie, newAssetData.source)
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
      const asset = MediaAsset.fromInit(init, this._movie, source)

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
      const newClip = new Clip(
        {
          ...clip.toObject(),
          id: this.generateId(),
          sourceStart: prevClipTime.source + delta,
          duration: prevClipTime.duration - delta,
        },
        this._movie,
      )
      clip.transition = undefined
      clip.duration = delta

      newClip.position({ parentId: parent.id, index: clip.index + 1 })

      this.#selectClip(clip, false)

      return newClip
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

        root._emit(new NodeUpdateEvent(from.id, from.node))

        if (node.parent?.id !== from.position?.parentId) root._emit(new NodeMoveEvent(from.id, from.position))
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
    const serialize = <T extends Schema.AnyNodeSchema>(
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
    return serialize(this._movie)
  }

  async export(): Promise<{ blob: Blob; url: string } | undefined> {
    this.#exportResult.value = undefined

    const onProgress = (value: number): void => void (this.#exportProgress.value = value)

    this._movie.pause()
    onProgress(0)

    try {
      const exporter = new MovieExporter(this._movie)

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
