import { registerAacEncoder } from '@mediabunny/aac-encoder'
import { createEffectScope } from 'fine-jsx'
import * as Mb from 'mediabunny'

import type { MediaAsset } from '#core'
import type * as pub from '#core'
import { Rational, setObjectSize } from 'shared/utils/index.ts'
import { rangesIntersect } from 'shared/video/utils.ts'

import { Document } from '../../document.ts'
import { DocumentView, type ViewType } from '../document-view.ts'
import { RenderDocument, type RenderDocumentOptions } from '../render/index.ts'

import { ExportClip, ExportMediaClip } from './export-clip.ts'

interface AvAssetEntry {
  asset: MediaAsset
  start: number
  end: number
  input: Mb.Input
  audio: Mb.InputAudioTrack | null
  video: Mb.InputVideoTrack | null
  audioBuffer?: AudioBuffer
  isAudioOnly: boolean
  consumers: number
}

interface ViewTypeMap {
  'clip:video': ExportMediaClip | ExportClip
  'clip:audio': ExportMediaClip
  'clip:image': ExportClip
  'clip:text': ExportClip
}

let decoderAudioContext: OfflineAudioContext | undefined

export class ExportDocument extends DocumentView<ViewTypeMap> {
  renderView: RenderDocument
  range: { start: number; end: number }
  duration: number
  mute: boolean
  clips: (ExportMediaClip | ExportClip)[] = []
  sources = new Map<string, AvAssetEntry>()
  output!: Mb.Output
  canvasSource!: Mb.CanvasSource
  audioBufferSource!: Mb.AudioBufferSource
  hasAudio = false
  hasVideo = false

  audioEncoderConfig = {
    numberOfChannels: 2,
    sampleRate: 44100,
  } as const
  videoEncoderConfig!: VideoEncoderConfig

  readonly #scope = createEffectScope()

  get isReady(): boolean {
    return !this.doc.activeClipIsStalled.value
  }

  constructor(options: {
    doc: pub.Document
    renderOptions: RenderDocumentOptions
    start?: number
    end?: number
    mute?: boolean
  }) {
    const originalDoc = options.doc
    const { gl, renderer } = options.renderOptions
    const doc = new Document(originalDoc)
    const renderView = new RenderDocument({ doc, gl, renderer, applyVideoRotation: true })
    const start = options.start ?? 0
    const end = options.end ?? originalDoc.duration

    super(doc)

    this.renderView = renderView
    this.range = { start, end }
    this.duration = end - start
    this.mute = !!options.mute

    this._init()

    originalDoc.timeline.children.forEach((track_, trackIndex) => {
      const track = doc.createNode(track_.toJSON())
      track.move({ parentId: doc.timeline.id, index: trackIndex })

      if (track_.isAudio() && this.mute) return

      let skippedDuration = Rational.ZERO

      track_.children.forEach((trackChild, index) => {
        if (!rangesIntersect(this.range, trackChild.presentationTime)) {
          skippedDuration = trackChild.gap.add(trackChild.duration)
          return
        }

        const child = doc.createNode(trackChild.toJSON())
        child.move({ parentId: track.id, index })
        child.gap = trackChild.gap.add(skippedDuration)
        skippedDuration = Rational.ZERO
      })
    })

    if (import.meta.env.DEV) this.renderView._debug()
  }

  protected _createView<T extends pub.AnyNode>(original: T): ViewType<ViewTypeMap, T> | undefined {
    if (!original.isClip() || (original.isAudio() && this.mute)) return

    let view

    if (original.isMediaClip() && original.asset) view = new ExportMediaClip(this, original)
    else if (original.isVideo()) view = new ExportClip(this, original)

    if (view) this.#prepareClip(view)

    return view as ViewType<ViewTypeMap, T> | undefined
  }

  #prepareClip(exportClip: ExportMediaClip | ExportClip): void {
    this.clips.push(exportClip)

    if (!exportClip.original.isMediaClip()) return

    const { original } = exportClip
    const { asset, time: clipTime } = original

    if (!asset) return

    const { source: sourceStart, duration } = clipTime
    const sourceEnd = sourceStart + duration

    if (!asset.blob) throw new Error(`[webgl-video-editor]: missing asset "${original.mediaRef?.id}"`)

    let sourceEntry = this.sources.get(asset.id)

    if (sourceEntry) {
      sourceEntry.isAudioOnly &&= original.isAudio()
    } else {
      const input = new Mb.Input({
        formats: Mb.ALL_FORMATS,
        source: new Mb.BlobSource(asset.blob),
      })
      sourceEntry = {
        asset,
        start: sourceStart,
        end: sourceEnd,
        input,
        video: null,
        audio: null,
        isAudioOnly: original.isAudio(),
        consumers: 0,
      }
      this.sources.set(asset.id, sourceEntry)
    }

    sourceEntry.consumers += 1
    sourceEntry.start = Math.min(sourceEntry.start, sourceStart)
    sourceEntry.end = Math.max(sourceEntry.end, sourceEnd)
  }

  async #prepareSource(entry_: AvAssetEntry): Promise<void> {
    const entry = entry_
    await entry.asset._refreshObjectUrl()

    const { input, isAudioOnly } = entry
    const video = isAudioOnly ? null : (entry.video = await input.getPrimaryVideoTrack())
    const audio = this.mute ? null : (entry.audio = await input.getPrimaryAudioTrack())

    if (audio && !(await audio.canDecode())) {
      const encodedFileData = await entry.asset.blob!.arrayBuffer()
      decoderAudioContext ??= new OfflineAudioContext({ ...this.audioEncoderConfig, length: 1 })
      entry.audioBuffer = await decoderAudioContext.decodeAudioData(encodedFileData)
    }

    if (video && !(await video.canDecode()))
      throw new Error(
        `[webgl-video-editor] Unable to decode video codec "${(await video.getDecoderConfig())?.codec ?? 'unknown'}"`,
      )

    this.hasVideo ||= !isAudioOnly
    this.hasAudio ||= !!audio
  }

  async start({
    onProgress,
    signal,
  }: {
    onProgress?: (value: number) => void
    signal?: AbortSignal
  }): Promise<Blob> {
    await Promise.all(Array.from(this.sources.values()).map((entry) => this.#prepareSource(entry)))

    signal?.throwIfAborted()

    this.clips.forEach((clip) => {
      clip.init()
      this.hasVideo ||= clip.original.isVideo()
    })

    let codec: Mb.VideoCodec | undefined

    for (const c of ['vp9', 'vp8', 'avc'] as const) {
      // eslint-disable-next-line no-await-in-loop -- sequential checks
      if (await Mb.canEncodeVideo(c)) codec = c
    }

    if (!codec) throw new Error('No supported video codec to encode.')

    const output = (this.output = new Mb.Output({
      format: codec === 'avc' ? new Mb.Mp4OutputFormat() : new Mb.WebMOutputFormat(),
      target: new Mb.BufferTarget(),
    }))

    if (this.hasVideo) {
      this.canvasSource = new Mb.CanvasSource(this.renderView.canvas, {
        codec,
        quality: new Mb.Quality('high'),
      })
      output.addVideoTrack(this.canvasSource, { frameRate: this.doc.frameRate })
    }

    if (this.hasAudio) {
      let codec: Mb.AudioCodec

      if (await Mb.canEncodeAudio('opus')) codec = 'opus'
      else {
        codec = 'aac'
        if (!(await Mb.canEncodeAudio('aac'))) registerAacEncoder()
      }

      this.audioBufferSource = new Mb.AudioBufferSource({
        ...this.audioEncoderConfig,
        codec,
        quality: new Mb.Quality('high'),
      })
      output.addAudioTrack(this.audioBufferSource)
    }

    onProgress?.(0)

    await output.start()
    await Promise.all([this.#renderVideo({ signal, onProgress }), this.#renderAudio({ signal })])

    await output.finalize()
    return new Blob([output.target.buffer!], { type: 'video/mp4' })
  }

  async #renderVideo({
    signal,
    onProgress,
  }: {
    signal?: AbortSignal
    onProgress?: (progress: number) => void
  }): Promise<void> {
    if (!this.hasVideo) return

    const { renderView, doc } = this
    const { duration: docDuration, resolution, frameRate } = doc

    const { start, end } = this.range
    const totalFrames = docDuration * frameRate
    const startFrame = Math.floor(start * frameRate)
    const endFrame = Math.floor(end * frameRate)
    const frameCount = endFrame - startFrame
    const frameDurationS = 1 / frameRate

    setObjectSize(this.renderView.canvas, resolution)

    await renderView.whenRendererIsReady

    /* eslint-disable no-await-in-loop -- sequential */
    for (let i = 0; i < frameCount; i++) {
      await this.#seekAndWaitForVideoClips(docDuration * (i / totalFrames), signal)
      this.renderView.render()
      await this.canvasSource.add(this.doc.currentTime - start, frameDurationS)
      onProgress?.(i / frameCount)
    }
    /* eslint-enable no-await-in-loop */
  }

  async #seekAndWaitForVideoClips(time: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    this.doc._setCurrentTime(time)

    const seekPromise = Promise.all(
      this.clips.map(async (exportClip) => {
        const { original } = exportClip
        if (!original.isVideo()) return

        exportClip.updateVisibility()

        if (!original.isInPresentationTime) return

        if (exportClip.isExportMediaClip()) await exportClip.seekVideo()

        exportClip.renderClip?.onRendererUpdate()

        signal?.throwIfAborted()
        if (!exportClip.isReady) await exportClip.whenReady(this._abort.signal)
      }),
    )

    await (signal
      ? Promise.race([
          seekPromise,
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', reject)
          }),
        ])
      : seekPromise)
  }

  async #renderAudio({ signal }: { signal?: AbortSignal }): Promise<void> {
    if (!this.hasVideo) return

    const { numberOfChannels, sampleRate } = this.audioEncoderConfig
    const ctx = new OfflineAudioContext({
      numberOfChannels,
      sampleRate,
      length: sampleRate * this.duration,
    })

    await Promise.all(
      this.clips.map(async (exportClip) => {
        if (!exportClip.isExportMediaClip()) return

        const { time: clipTime } = exportClip.original
        await exportClip.seekAudio(clipTime.start)

        /* eslint-disable no-await-in-loop -- sequential */
        while (exportClip.currentAudioData) {
          const { buffer, timestamp, duration } = exportClip.currentAudioData
          const bufferOffsetS = timestamp / 1e6 - clipTime.source
          const trimStartS = -Math.min(bufferOffsetS, 0)
          const durationS = duration / 1e6
          const trimEnd = Math.max(0, bufferOffsetS + durationS - clipTime.end)
          const bufferDurationS = Math.min(durationS - trimStartS - trimEnd, clipTime.duration)

          if (bufferDurationS > 0) {
            const bufferSource = ctx.createBufferSource()
            const scheduleStartS = clipTime.start + Math.max(0, bufferOffsetS)

            bufferSource.buffer = buffer
            bufferSource.start(scheduleStartS, trimStartS, bufferDurationS)
            bufferSource.connect(ctx.destination)
          }

          await exportClip.readNextAudio()
          signal?.throwIfAborted()
        }
        /* eslint-enable no-await-in-loop */
      }),
    )

    const rendered = await ctx.startRendering()
    signal?.throwIfAborted()
    await this.audioBufferSource.add(rendered)
  }

  dispose(): void {
    super.dispose()

    this.#scope.stop()
    this.sources.forEach((entry) => entry.input.dispose())
    this.sources.clear()
    this.doc.dispose()
  }

  static async exportFrameAtTime({
    doc,
    renderOptions,
    time,
    signal,
  }: {
    doc: pub.Document
    renderOptions: RenderDocumentOptions
    time: number
    signal?: AbortSignal
  }): Promise<HTMLCanvasElement> {
    const exporter = new ExportDocument({ doc, renderOptions, start: time, end: time, mute: true })

    try {
      await Promise.all(Array.from(exporter.sources.values()).map((entry) => exporter.#prepareSource(entry)))
      exporter.clips.forEach((clip) => clip.init())

      signal?.throwIfAborted()

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      const { width, height } = doc.resolution

      await exporter.#seekAndWaitForVideoClips(time, signal)

      exporter.renderView.render()
      const frame = new VideoFrame(exporter.renderView.canvas, { timestamp: 0 })
      canvas.width = width
      canvas.height = height
      context!.drawImage(frame, 0, 0)

      return canvas
    } finally {
      exporter.dispose()
    }
  }
}
