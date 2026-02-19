import { setObjectSize } from 'shared/utils'
import { Demuxer } from 'shared/video/demuxer'
import type { MediaContainerMetadata } from 'shared/video/types'
import { assertDecoderConfigIsSupported, setVideoEncoderConfigCodec } from 'shared/video/utils'

import { VIDEO_DECODER_HW_ACCEL_PREF } from '../constants.ts'
import { BaseMovie, type MediaAsset, type Movie } from '../nodes/index.ts'
import { Track } from '../nodes/track.ts'

import { AVEncoder } from './av-encoder.ts'
import { ExporterClip } from './exporter-clip.ts'
import type { MediaExtractor } from './media-extractor.ts'

const EMPTY_STREAM = new ReadableStream<never>({ start: (controller) => controller.close() })

let decoderAudioContext: OfflineAudioContext | undefined

const multiTee = <T>(source: ReadableStream<T>, n: number) => {
  const streams = [source]
  for (let i = 0; i < n - 1; i++) streams.push(...streams.pop()!.tee())
  return streams
}

interface AvAssetEntry {
  asset: MediaAsset
  start: number
  end: number
  demuxer: Demuxer
  info?: MediaContainerMetadata
  audio?: MediaExtractor.AudioInit
  video?: MediaExtractor.VideoInit
  isAudioOnly: boolean
  consumers: number
}

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

  readonly isReady = false

  constructor(movie: Movie) {
    super(movie)

    this.isPaused.value = false

    movie.timeline.children.forEach((track_) => {
      const track = new Track(track_.toObject(), this)
      this.timeline.pushChild(track)
      track_.children.forEach((clip_) => {
        const clip = new ExporterClip(clip_.toObject(), track)
        track.pushChild(clip)

        this.clips.push(clip)
        this.#prepareClip(clip)
      })
    })

    this.onDispose(() => {
      this.sources.clear()
    })
  }

  #prepareClip(clip: ExporterClip) {
    const { trackType } = clip.parent!
    const { sourceAsset: source } = clip
    const { source: sourceStart, duration } = clip.time
    const sourceEnd = sourceStart + duration
    let sourceEntry = this.sources.get(source.objectUrl)

    if (!sourceEntry) {
      const demuxer = new Demuxer()
      sourceEntry = {
        asset: clip.sourceAsset,
        start: sourceStart,
        end: sourceEnd,
        demuxer,
        info: undefined,
        video: undefined,
        audio: undefined,
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

  async #prepareSource(source: string, entry: AvAssetEntry) {
    await entry.asset._refreshObjectUrl()

    const getAudioBuffer = async () => {
      const encodedFileData = await entry.asset.blob.arrayBuffer()
      return await (decoderAudioContext ??= new OfflineAudioContext({
        ...this.audioEncoderConfig,
        length: 1,
      })).decodeAudioData(encodedFileData)
    }

    const { start, end, demuxer } = entry
    let metadata: MediaContainerMetadata

    try {
      metadata = entry.info = await demuxer.init(source)
    } catch (error) {
      // If the source can't be demuxed, decode with an AudioContext
      if (entry.isAudioOnly) {
        this.hasAudio = true
        const audioBuffer = await getAudioBuffer()
        const { numberOfChannels, sampleRate } = audioBuffer

        entry.audio = {
          config: { codec: 'unused', numberOfChannels, sampleRate },
          audioBuffer,
          getStream: () => EMPTY_STREAM,
        }
        return
      }

      throw error
    }

    if (!entry.isAudioOnly) {
      this.hasVideo = true
      const videoInfo = metadata.video!
      await assertDecoderConfigIsSupported('video', videoInfo)

      const streams = multiTee(demuxer.getChunkStream(videoInfo, start, end), entry.consumers)

      entry.video = {
        config: { ...videoInfo, hardwareAcceleration: VIDEO_DECODER_HW_ACCEL_PREF },
        getStream: () => streams.pop()!,
      }
    }

    const audioInfo = metadata.audio

    if (audioInfo) {
      this.hasAudio = true

      try {
        await assertDecoderConfigIsSupported('audio', audioInfo)

        const streams = multiTee(demuxer.getChunkStream(audioInfo, start, end), entry.consumers)

        entry.audio = {
          config: audioInfo,
          getStream: () => streams.pop()!,
        }
      } catch {
        // If decoding the audio with WebCodecs isn't supported, decode with an AudioContext instead
        entry.audio = {
          config: audioInfo,
          audioBuffer: await getAudioBuffer(),
          getStream: () => EMPTY_STREAM,
        }
      }
    }

    demuxer.start()
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

    await Promise.all(
      Array.from(this.sources.entries()).map(([source, entry]) => this.#prepareSource(source, entry)),
    )

    this.clips.forEach((clip) => {
      const { audio, video } = this.sources.get(clip.sourceAsset.objectUrl)!

      clip.extractor.init({ audio, video })
    })

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

    const buffer = avEncoder.finalize()
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
      await Promise.all(this.clips.map((clip) => clip.extractor.seekVideo()))

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
        const { extractor, time: clipTime } = clip
        await extractor.seekAudio(clipTime.start)

        while (extractor.currentAudioData && !signal?.aborted) {
          const { buffer, timestamp, duration } = extractor.currentAudioData
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

          await extractor.readNextAudio()
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
