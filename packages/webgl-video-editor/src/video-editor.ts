import { computed, ref, type Ref } from 'fine-jsx'
import { uid } from 'uid'
import { Renderer as EffectRenderer, type ExportResult } from 'webgl-effects'

import type { ClipDrag, ClipResize } from '#internal'
import type * as Schema from '#schema'
import type { Size } from 'shared/types'
import { IS_FIREFOX } from 'shared/userAgent.ts'
import { useElementSize } from 'shared/utils/composables.ts'
import { getWebgl2Context } from 'shared/utils/images.ts'
import { Rational, remap0 } from 'shared/utils/math'

import type * as pub from '../types/webgl-video-editor'

import { AssetBin } from './constants' 
import { useClipDragResize } from './components/utils.ts'
import { EditDocument } from './document-views/edit/edit-document.ts'
import type { EditView } from './document-views/edit/edit-nodes.ts'
import { ExportDocument } from './document-views/export/exporter-document.ts'
import { PlaybackDocument } from './document-views/playback/playback-document.ts'
import { RenderDocument } from './document-views/render/render-document.ts'
import { Document } from './document.ts'
import type { NodeDeleteEvent } from './events.ts'

const getClipAtTime = (track: pub.Track, time: number): pub.AnyClip | undefined => {
  for (let clip = track.firstClip; clip; clip = clip.nextClip) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip
  }
}

const INITIAL_SECONDS_PER_PIXEL = 0.01

export class VideoEditor implements pub.VideoEditor {
  doc!: EditDocument
  _editor = this
  readonly sync?: pub.VideoEditorDocumentSync

  readonly #selection = ref<pub.AnyTrackChild>()
  _secondsPerPixel = ref(INITIAL_SECONDS_PER_PIXEL)
  _timelineContainer = ref<HTMLElement>()
  _timelineSize = useElementSize(this._timelineContainer)
  _viewportSize: Ref<Size>
  _zoom = computed(() => this.viewportSize.width / this.doc.resolution.width)

  drag: ClipDrag
  resize: ClipResize

  effectRenderer: EffectRenderer
  playback: PlaybackDocument

  canvas = document.createElement('canvas')
  isDisposed = false
  readonly #ownsDoc: boolean

  get isPaused(): boolean {
    return this.playback.isPaused
  }

  get currentTime(): number {
    return this.doc.currentTime
  }

  get timelineContainer(): HTMLElement | undefined {
    return this._timelineContainer.value
  }
  set timelineContainer(value) {
    this._timelineContainer.value = value
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

  readonly #activeAssetBin = ref<AssetBin>(null)
  get activeAssetBin(): AssetBin {
    return this.#activeAssetBin.value
  }
  set activeAssetBin(value: AssetBin) {
    this.#activeAssetBin.value = value
  }

  readonly #exportResult = ref<ExportResult>()
  get exportResult(): ExportResult | undefined {
    return this.#exportResult.value
  }

  readonly #exportProgress = ref(-1)
  get exportProgress(): number {
    return this.#exportProgress.value
  }

  get selection(): EditView.AnyTrackChild | undefined {
    return this.doc._getNode(this.#selection.value)
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
    const doc = new EditDocument(sync?.doc ?? new Document({ assets }))

    this.#ownsDoc = !sync
    this.sync = sync
    this.doc = doc
    ;({ drag: this.drag, resize: this.resize } = useClipDragResize(this))

    const renderView = new RenderDocument({
      doc,
      applyVideoRotation: IS_FIREFOX,
      gl: getWebgl2Context(this.canvas, { stencil: true }),
    })
    this.playback = new PlaybackDocument({ renderView })

    this.effectRenderer = new EffectRenderer()

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
    const { duration } = asset
    const { trackType } = track

    const init: Schema.AnyClip = {
      id: this.generateId(),
      type: `clip:${trackType}`,
      mediaRef: { assetId: asset.id },
      sourceStart: Rational.fromDecimal(0, this.doc.frameRate),
      duration: Rational.fromDecimal(duration, this.doc.frameRate),
    }

    return this._transact(() => {
      const clip = this.doc.createNode(init)
      clip.move({ parentId: track.id, index: track.clipCount })
      return clip
    })
  }

  replaceClipAsset(asset: pub.MediaAsset): void {
    const clip = this.#selection.value
    if (!clip?.isClip()) return

    this._transact(() => {
      clip.duration = Rational.min(Rational.fromDecimal(asset.duration, clip.duration.rate), clip.duration)
      clip.mediaRef = { assetId: asset.id }
    })
  }

  splitClipAtCurrentTime(): [pub.AnyClip, pub.AnyClip] | undefined {
    const { currentTime, frameRate } = this.doc
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
    const prevClipTime = clip.timeRational
    const delta = Rational.fromDecimal(currentTime, frameRate).subtract(prevClipTime.start.toRate(frameRate))

    if (delta.value < 1) return

    return this._transact(() => {
      const startClip = this.doc.createNode({
        ...clip.toJSON(),
        id: this.generateId(),
        transition: undefined,
        duration: delta,
      })
      const endClip = this.doc.createNode({
        ...clip.toJSON(),
        id: this.generateId(),
        sourceStart: prevClipTime.source.add(delta),
        duration: prevClipTime.duration.subtract(delta),
      })

      startClip.move({ parentId: parent.id, index: clip.index })
      endClip.move({ parentId: parent.id, index: clip.index + 1 })

      this.#select(startClip, false)
      clip.delete()

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

    this._transact(() => clip.delete())
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
  #select(clip_: pub.AnyTrackChild | undefined, seek: boolean): void {
    const { doc } = this
    const clip = (this.#selection.value = doc._getNode(clip_))

    if (clip && seek) {
      const { start, end } = clip.time

      if (doc.currentTime < start) doc.seekTo(start)
      else if (doc.currentTime >= end) doc.seekTo(end - 1 / doc.frameRate)
    }
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

  async export(): Promise<{ blob: Blob; url: string } | undefined> {
    this.#exportResult.value = undefined

    const onProgress = (value: number): void => void (this.#exportProgress.value = value)

    this.playback.pause()
    onProgress(0)

    try {
      const exporter = new ExportDocument({ doc: this.doc, renderOptions: this.playback.renderView })

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
    if (this.#ownsDoc) this.doc.dispose()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
