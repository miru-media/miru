import { setObjectSize } from 'shared/utils'
import { Demuxer } from 'shared/video/demuxer'
import type { MediaContainerMetadata } from 'shared/video/types'
import { assertDecoderConfigIsSupported, setVideoEncoderConfigCodec } from 'shared/video/utils'

import { VIDEO_DECODER_HW_ACCEL_PREF } from '../constants'
import type { MediaAsset, Movie } from '../nodes'

import { AVEncoder } from './av-encoder'
import { ExportMovie } from './export-movie'
import type { ExtractorClip } from './exporter-clip'
import type { MediaExtractorNode } from './media-extractor-node'

interface AvAssetEntry {
  asset: MediaAsset
  start: number
  end: number
  demuxer: Demuxer
  info?: MediaContainerMetadata
  audio?: MediaExtractorNode.AudioInit
  video?: MediaExtractorNode.VideoInit
  isAudioOnly: boolean
  consumers: number
}

let decoderAudioContext: OfflineAudioContext | undefined

const multiTee = <T>(source: ReadableStream<T>, n: number) => {
  const streams = [source]
  for (let i = 0; i < n - 1; i++) streams.push(...streams.pop()!.tee())
  return streams
}

export class MovieExporter {
  movie: ExportMovie
  clips: ExtractorClip[] = []
  sources = new Map<string, AvAssetEntry>()
  avEncoder?: AVEncoder

  constructor(movie: Movie) {
    const exportMovie = (this.movie = new ExportMovie(movie))

    exportMovie.children.forEach((track) => {
      for (let clip = track.head; clip; clip = clip.next) {
        this.clips.push(clip)

        const { source } = clip
        const { source: sourceStart, duration } = clip.time
        const sourceEnd = sourceStart + duration
        let sourceEntry = this.sources.get(source.objectUrl)

        if (!sourceEntry) {
          const demuxer = new Demuxer()
          sourceEntry = {
            asset: clip.source,
            start: sourceStart,
            end: sourceEnd,
            demuxer,
            info: undefined,
            video: undefined,
            audio: undefined,
            isAudioOnly: track.trackType === 'audio',
            consumers: 0,
          }
          this.sources.set(source.objectUrl, sourceEntry)
        } else {
          sourceEntry.isAudioOnly &&= track.trackType === 'audio'
        }

        sourceEntry.consumers++
        sourceEntry.start = Math.min(sourceEntry.start, sourceStart)
        sourceEntry.end = Math.max(sourceEntry.end, sourceEnd)
      }
    })
  }

  async start({ onProgress, signal }: { onProgress?: (value: number) => void; signal?: AbortSignal }) {
    const { movie } = this
    const { duration, resolution } = movie
    const framerate = movie.frameRate.value
    const { canvas } = movie.gl

    let hasAudio = false as boolean
    let hasVideo = false as boolean

    const emptyStream = new ReadableStream<never>({ start: (controller) => controller.close() })

    const audioEncoderConfig = {
      numberOfChannels: 2,
      sampleRate: 44100,
      codec: 'opus',
    } as const

    await Promise.all(
      Array.from(this.sources.entries()).map(async ([source, entry]) => {
        await entry.asset._refreshObjectUrl()

        const getAudioBuffer = async () => {
          const encodedFileData = await entry.asset.blob.arrayBuffer()
          return await (decoderAudioContext ??= new OfflineAudioContext({
            ...audioEncoderConfig,
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
            hasAudio = true
            const audioBuffer = await getAudioBuffer()
            const { numberOfChannels, sampleRate } = audioBuffer

            entry.audio = {
              config: { codec: 'unused', numberOfChannels, sampleRate },
              audioBuffer,
              getStream: () => emptyStream,
            }
            return
          }

          throw error
        }

        if (!entry.isAudioOnly) {
          hasVideo = true
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
          hasAudio = true

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
              getStream: () => emptyStream,
            }
          }
        }

        demuxer.start()
      }),
    )

    this.clips.forEach((clip) => {
      const { audio, video } = this.sources.get(clip.source.objectUrl)!

      clip.node.init({ audio, video })
    })

    const durationUs = duration * 1e6

    const videoEncoderConfig: VideoEncoderConfig = {
      codec: '',
      ...resolution,
      framerate: framerate,
      // bitrate: 1e7,
    }

    if (hasVideo) await setVideoEncoderConfigCodec(videoEncoderConfig)

    const avEncoder = (this.avEncoder = await new AVEncoder({
      video: hasVideo ? videoEncoderConfig : undefined,
      audio: hasAudio ? audioEncoderConfig : undefined,
      onOutput: (type, timestamp) => {
        if (type === 'video' || !hasVideo) onProgress?.(timestamp / durationUs)
      },
    }).init())

    const { videoContext } = movie
    videoContext.play()
    onProgress?.(0)

    await Promise.all([
      // Video
      (async () => {
        const writer = avEncoder.video?.getWriter()
        if (!writer) return

        const totalFrames = duration * framerate
        const frameDurationUs = 1e6 / framerate

        for (let i = 0; i < totalFrames && !signal?.aborted; i++) {
          const timeS = duration * (i / totalFrames)
          await Promise.all(this.clips.map((clip) => clip.node.seekVideo(timeS)))

          setObjectSize(movie.gl.canvas, movie.resolution)
          videoContext.currentTime = timeS
          videoContext.update(0)

          const frame = new VideoFrame(canvas, { timestamp: 1e6 * timeS, duration: frameDurationUs })
          await writer.write(frame)
          frame.close()
        }

        await writer.close()
      })(),

      // Audio
      (async () => {
        const writer = avEncoder.audio?.getWriter()
        if (!writer) return

        const { numberOfChannels, sampleRate } = audioEncoderConfig
        const ctx = new OfflineAudioContext({ numberOfChannels, sampleRate, length: sampleRate * duration })

        await Promise.all(
          this.clips.map(async (clip) => {
            const { node, time: clipTime } = clip
            await node.seekAudio(clipTime.start)

            while (node.currentAudioData && !signal?.aborted) {
              const { buffer, timestamp, duration } = node.currentAudioData
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

              await node.readNextAudio()
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
      })(),
    ])

    await avEncoder.flush()

    const buffer = avEncoder.finalize()
    return new Blob([buffer], { type: 'video/mp4' })
  }

  dispose() {
    this.movie.dispose()
    this.sources.clear()
  }
}
