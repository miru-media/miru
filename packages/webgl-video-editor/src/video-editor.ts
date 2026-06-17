import { computed, ref, type Ref } from 'fine-jsx'
import { uid } from 'uid'
import { Renderer as EffectRenderer } from 'webgl-effects'

import type * as pub from '#core'
import type { ClipResize } from '#internal'
import type * as Schema from '#schema'
import type { Size } from 'shared/types'
import { IS_FIREFOX } from 'shared/userAgent.ts'
import { useElementSize, useFullscreen } from 'shared/utils/composables.ts'
import { getWebgl2Context } from 'shared/utils/images.ts'
import { Rational } from 'shared/utils/math'

import { useClipDragResize } from './components/interactions/clip-drag-resize.ts'
import { useTrackDropzone } from './components/interactions/track-dropzone.ts'
import type { AssetBin } from './constants.ts'
import { EditDocument } from './document-views/edit/edit-document.ts'
import type { EditView } from './document-views/edit/edit-nodes.ts'
import { PlaybackDocument } from './document-views/playback/playback-document.ts'
import { RenderDocument } from './document-views/render/render-document.ts'
import { Document } from './document.ts'
import type { NodeDeleteEvent } from './events.ts'
import { TimelineZoom } from './utils.ts'

const MOBILE_SCREEN_CUTOFF_PX = 1000

export class VideoEditor implements pub.VideoEditor {
  readonly #uid = uid()

  readonly doc: EditDocument
  readonly _editor = this
  readonly sync?: pub.VideoEditorDocumentSync

  readonly #selection = ref<pub.AnyTrackChild | pub.GapSelection>()
  readonly _timelineContainer = ref<HTMLElement>()
  readonly _timelineSize = useElementSize(this._timelineContainer)
  readonly _viewportContainer = ref<HTMLElement>()
  readonly _fullscreen = useFullscreen(this._viewportContainer)
  readonly _viewportSize: Ref<Size>
  readonly _viewport = ref<HTMLElement>()
  readonly _workspaceContainer = ref<HTMLElement>()
  readonly _workspaceSize = useElementSize(this._workspaceContainer)
  readonly _zoom = computed(() => this.viewportSize.width / this.doc.resolution.width)

  readonly timelineZoom = new TimelineZoom(this._workspaceSize, () => this.doc)

  get drag() {
    return this.doc.clipDrag
  }
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

  _isMobileWorkspace = computed(() => {
    const { width } = this._workspaceSize.value
    return width !== 0 && width < MOBILE_SCREEN_CUTOFF_PX
  })

  get isMobileWorkspace(): boolean {
    return this._isMobileWorkspace.value
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

  readonly #exportProgress = ref(-1)
  get exportProgress(): number {
    return this.#exportProgress.value
  }

  get selection(): EditView.AnyTrackChild | pub.GapSelection | undefined {
    const selection = this.#selection.value
    return selection?.isNode ? this.doc._getNode(selection) : selection
  }

  get tracks(): pub.Track[] {
    return this.doc.timeline.children
  }

  get viewportSize(): Size {
    return this._viewportSize.value
  }

  get canvasZoom(): number {
    return this._zoom.value
  }

  constructor(options: { sync?: pub.VideoEditorDocumentSync; assets?: pub.VideoEditorAssetStore } = {}) {
    const { sync, assets } = options
    const doc = new EditDocument(sync?.doc ?? new Document({ assets }))

    this.#ownsDoc = !sync
    this.sync = sync
    this.doc = doc
    ;({ resize: this.resize } = useClipDragResize(this))
    useTrackDropzone(this)

    const renderView = new RenderDocument({
      doc,
      applyVideoRotation: IS_FIREFOX,
      gl: getWebgl2Context(this.canvas, { stencil: true }),
    })
    this.playback = new PlaybackDocument({ renderView })

    this.effectRenderer = new EffectRenderer()

    this.doc.on('node:delete', (event: NodeDeleteEvent) => {
      const { selection } = this
      if (!selection) return
      const deletedId = event.node.id

      if (
        // unselect the deleted node
        (selection.isNode && deletedId === selection.id) ||
        // unselect the gaps around the deleted node
        !((selection.isNode && selection.prev?.id === deletedId) || selection.next?.id === deletedId)
      )
        this.select(undefined)
    })

    this.doc.on('canvas:pointerdown', ({ node }) => this.select(node))

    this._viewportSize = useElementSize(this.canvas)
  }

  generateId(): string {
    const { sync } = this
    return sync ? sync.generateId() : uid()
  }

  getPartId(part: string): string {
    return `${part}-${this.#uid}`
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
      clip.move({ parentId: track.id, index: track.children.length })
      return clip
    })
  }

  replaceClipAsset(asset: pub.MediaAsset): void {
    const clip = this.#selection.value
    if (!clip?.isNode || !clip.isClip()) return

    this._transact(() => {
      clip.duration = Rational.min(Rational.fromDecimal(asset.duration, clip.duration.rate), clip.duration)
      clip.mediaRef = { assetId: asset.id }
    })
  }

  splitClip(clip: pub.AnyClip, time: number): [pub.AnyClip, pub.AnyClip] | undefined {
    if (!clip.parent) return

    const { parent, gap: startGap } = clip
    const clipTime = clip.timeRational
    const { frameRate } = this.doc
    const endGap = clip.next?.gap

    const splitTimeRational = Rational.fromDecimal(time, frameRate)

    if (clipTime.end.toRate(frameRate).subtract(splitTimeRational).value < 1) return

    const delta = splitTimeRational.subtract(clipTime.start.toRate(frameRate))

    if (delta.value < 1) return

    const startClip = this.doc.createNode({
      ...clip.toJSON(),
      id: this.generateId(),
      transition: undefined,
      duration: delta,
    })
    const endClip = this.doc.createNode({
      ...clip.toJSON(),
      id: this.generateId(),
      sourceStart: clipTime.source.add(delta),
      duration: clipTime.duration.subtract(delta),
    })

    startClip.move({ parentId: parent.id, index: clip.index })
    endClip.move({ parentId: parent.id, index: clip.index + 1 })

    startClip.gap = startGap
    if (endClip.next && endGap) endClip.next.gap = endGap

    this.#select(startClip, false)
    clip.delete()

    return [startClip, endClip]
  }

  getTrackForMedia(asset: { video?: boolean | pub.MediaAsset['video'] }) {
    const trackType = (asset.video ?? false) === false ? 'audio' : 'video'

    // add to the last track of the correct type
    return [...this.tracks].reverse().find((t) => t.trackType === trackType) ?? this.addTrack(trackType)
  }

  addTrack(trackType: 'video' | 'audio'): pub.Track {
    const { doc } = this

    return this._transact(() => {
      const track = doc.createNode({ id: this.generateId(), trackType, type: 'track' })
      track.move({ parentId: doc.timeline.id, index: 0 })
      return track
    })
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

  select(item: pub.AnyTrackChild | pub.GapSelection | undefined, seek = item?.isNode ?? true): void {
    this.#select(item, seek)
  }
  #select(item: pub.AnyTrackChild | pub.GapSelection | undefined, seek: boolean): void {
    const { doc } = this

    if (!item) {
      this.#selection.value = undefined
      return
    }

    const node = doc._getNode(item.isNode ? item : item.node)
    this.#selection.value = item.isNode
      ? node
      : {
          node,
          isNode: false,
          get prev() {
            return node.prev
          },
          get next() {
            return node.next
          },
        }

    if (item.isNode && seek) {
      const { start, end } = node.time

      if (doc.currentTime < start) doc.seekTo(start)
      else if (doc.currentTime >= end) doc.seekTo(end - 1 / doc.frameRate)
    }
  }

  _transact<T>(fn: () => T): T {
    return this.sync ? this.sync.transact(fn) : fn()
  }

  secondsToPixels(time: number): number {
    return this.timelineZoom.secondsToPixels(time)
  }

  pixelsToSeconds(offset: number): number {
    return this.timelineZoom.pixelsToSeconds(offset)
  }

  async export(options?: { signal?: AbortSignal }): Promise<Blob> {
    const onProgress = (value: number): void => void (this.#exportProgress.value = value)

    this.playback.pause()
    onProgress(0)

    try {
      const { ExportDocument } = await import('./document-views/export/exporter-document.ts')
      const exporter = new ExportDocument({ doc: this.doc, renderOptions: this.playback.renderView })
      let result

      await this.playback
        .withoutRendering(async () => {
          const blob = await exporter.start({ onProgress, signal: options?.signal })
          result = blob
        })
        .finally(() => exporter.dispose())

      return result!
    } finally {
      onProgress(-1)
    }
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
