import { createEffectScope } from 'fine-jsx'
import * as Mb from 'mediabunny'

import type { MediaAsset } from '#core'
import type * as pub from '#core'
import { Track } from '#nodes'
import { Rational, setObjectSize } from 'shared/utils'
import { rangesIntersect, setVideoEncoderConfigCodec } from 'shared/video/utils'

import { Document } from '../../document.ts'
import { DocumentView, type ViewType } from '../document-view.ts'
import { RenderDocument, type RenderDocumentOptions } from '../render/render-document.ts'

import { AVEncoder } from './av-encoder.ts'
import { ExportMediaClip, ExportNonMediaVideoClip } from './export-clip.ts'

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
  'clip:video': ExportMediaClip | ExportNonMediaVideoClip
  'clip:audio': ExportMediaClip
  'clip:text': ExportNonMediaVideoClip
}

let decoderAudioContext: OfflineAudioContext | undefined

export class ExportDocument extends DocumentView<ViewTypeMap> {
  renderView: RenderDocument
  range: { start: number; end: number }
  duration: number
  mute: boolean
  clips: (ExportMediaClip | ExportNonMediaVideoClip)[] = []
  sources = new Map<string, AvAssetEntry>()
  avEncoder!: AVEncoder
  hasAudio = false
  hasVideo = false

  audioEncoderConfig = {
    numberOfChannels: 2,
    sampleRate: 44100,
    codec: 'opus',
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
      const track = new Track(doc, track_.toJSON())
      track.move({ parentId: doc.timeline.id, index: trackIndex })

      if (track_.isAudio() && this.mute) return

      let skippedDuration = Rational.ZERO

      track_.children.forEach((trackChild, index) => {
        if (!rangesIntersect(this.range, trackChild.presentationTime)) {
          skippedDuration = trackChild.gap.add(trackChild.duration)
          return
        }

        const child = doc.createNode(trackChild)
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
    else if (original.isVideo()) view = new ExportNonMediaVideoClip(this, original)

    if (view) this.#prepareClip(view)

    return view as ViewType<ViewTypeMap, T> | undefined
  }

  #prepareClip(exportClip: ExportMediaClip | ExportNonMediaVideoClip): void {
    this.clips.push(exportClip)

    if (!exportClip.original.isMediaClip()) return

    const { original } = exportClip
    const { asset, time: clipTime } = original

    if (!asset) return

    const { source: sourceStart, duration } = clipTime
    const sourceEnd = sourceStart + duration

    if (!asset.blob) throw new Error(`[webgl-video-editor]: missing asset "${original.mediaRef?.assetId}"`)

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
    const { resolution, frameRate } = this.doc

    const videoEncoderConfig = (this.videoEncoderConfig = {
      codec: '',
      ...resolution,
      framerate: frameRate,
    })
    const { audioEncoderConfig } = this

    await Promise.all(Array.from(this.sources.values()).map((entry) => this.#prepareSource(entry)))

    signal?.throwIfAborted()

    this.clips.forEach((clip) => {
      clip.init()
      this.hasVideo ||= clip.original.isVideo()
    })

    if (this.hasVideo) await setVideoEncoderConfigCodec(videoEncoderConfig)

    const durationUs = this.duration * 1e6

    const avEncoder = (this.avEncoder = await new AVEncoder({
      video: this.hasVideo ? videoEncoderConfig : undefined,
      audio: this.hasAudio ? audioEncoderConfig : undefined,
      onOutput: (type, timestamp) => {
        if (!signal?.aborted && (type === 'video' || !this.hasVideo)) onProgress?.(timestamp / durationUs)
      },
    }).init())

    onProgress?.(0)

    await Promise.all([this.#renderVideo({ signal }), this.#renderAudio({ signal })])

    await avEncoder.flush()

    const buffer = await avEncoder.finalize()
    return new Blob([buffer], { type: 'video/mp4' })
  }

  async #renderVideo({ signal }: { signal?: AbortSignal }): Promise<void> {
    const { renderView, doc } = this
    const { duration: docDuration, resolution, frameRate } = doc
    const writer = this.avEncoder.video?.getWriter()
    if (!writer) return

    const { start, end } = this.range
    const totalFrames = docDuration * frameRate
    const startFrame = Math.floor(start * frameRate)
    const endFrame = Math.floor(end * frameRate)
    const frameDurationUs = 1e6 / frameRate

    setObjectSize(this.renderView.canvas, resolution)

    await renderView.whenRendererIsReady

    /* eslint-disable no-await-in-loop -- sequential */
    for (let i = startFrame; i < endFrame; i++) {
      await this.#seekAndWaitForVideoClips(docDuration * (i / totalFrames), signal)

      this.renderView.render()

      const frame = new VideoFrame(this.renderView.canvas, {
        timestamp: (this.doc.currentTime - start) * 1e6,
        duration: frameDurationUs,
      })

      await writer.write(frame)

      frame.close()
    }
    /* eslint-enable no-await-in-loop */

    await writer.close()
  }

  async #seekAndWaitForVideoClips(time: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    this.doc._setCurrentTime(time)

    const seekPromise = Promise.all(
      this.clips.map(async (exportClip) => {
        const { original } = exportClip
        if (!original.isVideo()) return

        if (!original.isInClipTime) {
          exportClip.updateVisibility()
          return
        }

        if (exportClip.isExportMediaClip()) await exportClip.seekVideo()
        else exportClip.updateVisibility()

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
    const { avEncoder } = this
    const writer = avEncoder.audio?.getWriter()
    if (!writer) return

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

    const f32Planar = new Float32Array(rendered.length * rendered.numberOfChannels)
    for (let i = 0; i < rendered.numberOfChannels; i++)
      rendered.copyFromChannel(
        new Float32Array(
          f32Planar.buffer,
          i * rendered.length * Float32Array.BYTES_PER_ELEMENT,
          rendered.length,
        ),
        i,
      )

    await writer.write(
      new avEncoder.AudioData({
        format: 'f32-planar',
        timestamp: 0,
        sampleRate,
        numberOfChannels,
        numberOfFrames: rendered.length,
        data: f32Planar,
        transfer: [f32Planar.buffer],
      }),
    )
    await writer.close()
  }

  dispose(): void {
    super.dispose()

    this.#scope.stop()
    this.sources.forEach((entry) => entry.input.dispose())
    this.sources.clear()
    this.doc.dispose()
  }
}
