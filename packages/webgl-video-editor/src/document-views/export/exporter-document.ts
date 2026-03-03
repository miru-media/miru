import * as Mb from 'mediabunny'

import type { MediaAsset } from '#core'
import type * as pub from '#core'
import { Track } from '#nodes'
import { setObjectSize } from 'shared/utils'
import { setVideoEncoderConfigCodec } from 'shared/video/utils'

import { Document } from '../../document.ts'
import { DocumentView, type ViewType } from '../document-view.ts'
import { RenderDocument, type RenderDocumentOptions } from '../render/render-document.ts'

import { AVEncoder } from './av-encoder.ts'
import { ExportClip } from './export-clip.ts'

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
  clip: ExportClip
}

let decoderAudioContext: OfflineAudioContext | undefined

export class ExportDocumentView extends DocumentView<ViewTypeMap> {
  renderView: RenderDocument
  clips: ExportClip[] = []
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

  get isReady(): boolean {
    return !this.doc.activeClipIsStalled.value
  }

  constructor(options: { doc: pub.Document; renderOptions: RenderDocumentOptions }) {
    const originalDoc = options.doc
    const { gl, renderer } = options.renderOptions
    const doc = new Document(originalDoc)
    const renderView = new RenderDocument({ doc, gl, renderer, applyVideoRotation: true })

    super({ ...options, doc })

    this.renderView = renderView

    this._init()

    originalDoc.timeline.children.forEach((track_, trackIndex) => {
      const track = new Track(doc, track_.toObject())
      track.move({ parentId: doc.timeline.id, index: trackIndex })

      track_.children.forEach((trackChild, index) =>
        doc.createNode(trackChild).move({ parentId: track.id, index }),
      )
    })

    if (import.meta.env.DEV) this.renderView._debug()
  }

  protected _createView<T extends pub.AnyNode>(original: T): ViewType<ViewTypeMap, T> {
    let view

    if (original.isClip()) {
      view = new ExportClip(this, original)
      this.#prepareClip(view)
    } else view = undefined

    return view as ViewType<ViewTypeMap, T>
  }

  #prepareClip(exportClip: ExportClip): void {
    const { asset, clipType, time: clipTime } = exportClip.original
    const { source: sourceStart, duration } = clipTime
    const sourceEnd = sourceStart + duration

    if (!asset?.blob)
      throw new Error(`[webgl-video-editor]: missing asset "${exportClip.original.sourceRef.assetId}"`)

    let sourceEntry = this.sources.get(asset.id)

    if (!sourceEntry) {
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
        isAudioOnly: clipType === 'audio',
        consumers: 0,
      }
      this.sources.set(asset.id, sourceEntry)
    } else {
      sourceEntry.isAudioOnly &&= clipType === 'audio'
    }

    sourceEntry.consumers++
    sourceEntry.start = Math.min(sourceEntry.start, sourceStart)
    sourceEntry.end = Math.max(sourceEntry.end, sourceEnd)
    this.clips.push(exportClip)
  }

  async #prepareSource(entry: AvAssetEntry): Promise<void> {
    await entry.asset._refreshObjectUrl()

    const { input, isAudioOnly } = entry
    const video = isAudioOnly ? null : (entry.video = await input.getPrimaryVideoTrack())
    const audio = (entry.audio = await input.getPrimaryAudioTrack())

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
    const { duration, resolution, frameRate } = this.doc

    const videoEncoderConfig = (this.videoEncoderConfig = {
      codec: '',
      ...resolution,
      framerate: frameRate,
      // bitrate: 1e7,
    })
    const { audioEncoderConfig } = this

    await Promise.all(Array.from(this.sources.values()).map((entry) => this.#prepareSource(entry)))

    this.clips.forEach((clip) => clip.init(this.sources.get(clip.original.asset!.id)!))

    const durationUs = duration * 1e6

    if (this.hasVideo) await setVideoEncoderConfigCodec(videoEncoderConfig)

    const avEncoder = (this.avEncoder = await new AVEncoder({
      video: this.hasVideo ? videoEncoderConfig : undefined,
      audio: this.hasAudio ? audioEncoderConfig : undefined,
      onOutput: (type, timestamp) => {
        if (type === 'video' || !this.hasVideo) onProgress?.(timestamp / durationUs)
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
    const { canvas } = renderView
    const { duration, resolution, frameRate } = doc
    const writer = this.avEncoder.video?.getWriter()
    if (!writer) return

    const totalFrames = duration * frameRate
    const frameDurationUs = 1e6 / frameRate

    setObjectSize(this.renderView.canvas, resolution)

    await renderView.whenRendererIsReady

    for (let i = 0; i < totalFrames && !signal?.aborted; i++) {
      this.doc._setCurrentTime(duration * (i / totalFrames))

      await Promise.all(
        this.clips.map(async (exportClip) => {
          if (!exportClip.original.isVisual()) return
          await exportClip.seekVideo()
          if (!exportClip.isReady) await exportClip.whenReady(this._abort.signal)
        }),
      )

      if (signal?.aborted) return
      renderView.render()

      const frame = new VideoFrame(canvas, {
        timestamp: this.doc.currentTime * 1e6,
        duration: frameDurationUs,
      })

      await writer.write(frame)

      frame.close()
    }

    await writer.close()
  }

  async #renderAudio({ signal }: { signal?: AbortSignal }): Promise<void> {
    const { avEncoder } = this
    const writer = avEncoder.audio?.getWriter()
    if (!writer) return

    const { numberOfChannels, sampleRate } = this.audioEncoderConfig
    const ctx = new OfflineAudioContext({
      numberOfChannels,
      sampleRate,
      length: sampleRate * this.doc.duration,
    })

    await Promise.all(
      this.clips.map(async (exportClip) => {
        const { time: clipTime } = exportClip.original
        await exportClip.seekAudio(clipTime.start)

        while (exportClip.currentAudioData && !signal?.aborted) {
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
        }
      }),
    )

    const rendered = await ctx.startRendering()
    if (signal?.aborted) return

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

    this.sources.forEach((entry) => entry.input.dispose())
    this.sources.clear()
    this.doc.dispose()
  }
}
