import * as Mb from 'mediabunny'

import { setObjectSize } from 'shared/utils'
import { setVideoEncoderConfigCodec } from 'shared/video/utils'

import { BaseMovie, Gap, type MediaAsset, type Movie } from '../nodes/index.ts'
import { Track } from '../nodes/track.ts'

import { AVEncoder } from './av-encoder.ts'
import { ExporterClip } from './exporter-clip.ts'

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

let decoderAudioContext: OfflineAudioContext | undefined

export class ExporterMovie extends BaseMovie {
  clips: ExporterClip[] = []
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

  get currentTime(): number {
    return super.currentTime
  }
  set currentTime(timeS: number) {
    this._currentTime.value = timeS
  }

  get isReady(): boolean {
    return !this.activeClipIsStalled.value
  }

  constructor(movie: Movie) {
    super(movie)

    this.isPaused.value = false

    movie.timeline.children.forEach((track_, trackIndex) => {
      const track = new Track(track_.toObject(), this)
      track.position({ parentId: this.timeline.id, index: trackIndex })

      track_.children.forEach((trackChild, index) => {
        let child

        if (trackChild.isClip()) {
          child = new ExporterClip(trackChild.toObject(), this)

          this.clips.push(child)
          this.#prepareClip(child, track.trackType)
        } else child = new Gap(trackChild, this)

        child.position({ parentId: track.id, index })
      })
    })

    this.onDispose(() => {
      this.sources.forEach((entry) => entry.input.dispose())
      this.sources.clear()
    })
  }

  #prepareClip(clip: ExporterClip, trackType: Track.TrackType) {
    const { sourceAsset: source } = clip
    const { source: sourceStart, duration } = clip.time
    const sourceEnd = sourceStart + duration
    let sourceEntry = this.sources.get(source.objectUrl)

    if (!sourceEntry) {
      const input = new Mb.Input({
        formats: Mb.ALL_FORMATS,
        source: new Mb.BlobSource(source.blob),
      })
      sourceEntry = {
        asset: clip.sourceAsset,
        start: sourceStart,
        end: sourceEnd,
        input,
        video: null,
        audio: null,
        isAudioOnly: trackType === 'audio',
        consumers: 0,
      }
      this.sources.set(source.objectUrl, sourceEntry)
    } else {
      sourceEntry.isAudioOnly &&= trackType === 'audio'
    }

    sourceEntry.consumers++
    sourceEntry.start = Math.min(sourceEntry.start, sourceStart)
    sourceEntry.end = Math.max(sourceEntry.end, sourceEnd)
  }

  async #prepareSource(entry: AvAssetEntry) {
    await entry.asset._refreshObjectUrl()

    const { input, isAudioOnly } = entry
    const video = isAudioOnly ? null : (entry.video = await input.getPrimaryVideoTrack())
    const audio = (entry.audio = await input.getPrimaryAudioTrack())

    if (audio && !(await audio.canDecode())) {
      const encodedFileData = await entry.asset.blob.arrayBuffer()
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

  async start({ onProgress, signal }: { onProgress?: (value: number) => void; signal?: AbortSignal }) {
    const { duration, resolution, frameRate } = this

    const videoEncoderConfig = (this.videoEncoderConfig = {
      codec: '',
      ...resolution,
      framerate: frameRate,
      // bitrate: 1e7,
    })
    const { audioEncoderConfig } = this

    await Promise.all(Array.from(this.sources.values()).map((entry) => this.#prepareSource(entry)))

    this.clips.forEach((clip) => clip.init(this.sources.get(clip.sourceAsset.objectUrl)!))

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
    const { duration, resolution, frameRate, canvas } = this
    const writer = this.avEncoder.video?.getWriter()
    if (!writer) return

    const totalFrames = duration * frameRate
    const frameDurationUs = 1e6 / frameRate

    setObjectSize(this.gl.canvas, resolution)
    const renderOptions = { container: this.stage }

    await this.whenRendererIsReady

    for (let i = 0; i < totalFrames && !signal?.aborted; i++) {
      this.currentTime = duration * (i / totalFrames)
      await Promise.all(
        this.clips.map(async (clip) => {
          await clip.seekVideo()
          // make sure effects etc. are loaded
          if (!clip.isReady) await clip.whenReady()
        }),
      )

      this.renderer.render(renderOptions)

      const frame = new VideoFrame(canvas, {
        timestamp: this.currentTime * 1e6,
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
    const ctx = new OfflineAudioContext({ numberOfChannels, sampleRate, length: sampleRate * this.duration })

    await Promise.all(
      this.clips.map(async (clip) => {
        const { time: clipTime } = clip
        await clip.seekAudio(clipTime.start)

        while (clip.currentAudioData && !signal?.aborted) {
          const { buffer, timestamp, duration } = clip.currentAudioData
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

          await clip.readNextAudio()
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
}
