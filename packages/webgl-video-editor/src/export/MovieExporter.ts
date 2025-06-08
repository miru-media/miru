import { setObjectSize } from 'shared/utils'
import { Demuxer } from 'shared/video/Demuxer'
import { type MediaChunk, type MediaContainerMetadata } from 'shared/video/types'
import { assertDecoderConfigIsSupported } from 'shared/video/utils'

import { type MediaAsset, type Movie, type Track } from '../nodes'

import { AVEncoder } from './AVEncoder'
import { type ExtractorClip } from './ExporterClip'
import { ExportMovie } from './ExportMovie'
import { type Mp4ExtractorNode } from './Mp4ExtractorNode'

interface AvAssetEntry {
  asset: MediaAsset
  start: number
  end: number
  demuxer: Demuxer
  info?: MediaContainerMetadata
  audio?: Mp4ExtractorNode.AudioInit
  video?: Mp4ExtractorNode.VideoInit
  isAudioOnly: boolean
}

let audioContext: AudioContext | undefined

export class MovieExporter {
  movie: ExportMovie
  tracks: Track<ExtractorClip>[] = []
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
          }
          this.sources.set(source.objectUrl, sourceEntry)
        } else {
          sourceEntry.isAudioOnly &&= track.trackType === 'audio'
        }

        sourceEntry.start = Math.min(sourceEntry.start, sourceStart)
        sourceEntry.end = Math.max(sourceEntry.end, sourceEnd)
      }
    })
  }

  async start({ onProgress, signal }: { onProgress?: (value: number) => void; signal?: AbortSignal }) {
    const { movie } = this
    const { duration, resolution } = movie
    const frameRate = movie.frameRate.value
    const { canvas } = movie.gl

    let hasAudio = false as boolean
    let hasVideo = false as boolean

    await Promise.all(
      Array.from(this.sources.entries()).map(async ([source, entry]) => {
        await entry.asset._refreshObjectUrl()

        const getAudioBuffer = async () => {
          const encodedFileData = await entry.asset.blob.arrayBuffer()
          return await (audioContext ??= new AudioContext()).decodeAudioData(encodedFileData)
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
              config: { codec: 'unused', numberOfChannels: numberOfChannels, sampleRate },
              audioBuffer,
              chunks: [],
            }
            return
          }

          throw error
        }

        if (!entry.isAudioOnly) {
          hasVideo = true
          const chunks: MediaChunk[] = []
          const videoInfo = metadata.video!
          await assertDecoderConfigIsSupported('video', videoInfo)

          entry.video = { config: videoInfo, chunks }
          demuxer.setExtractionOptions(videoInfo, (chunk) => chunks.push(chunk))
        }

        const audioInfo = metadata.audio
        if (audioInfo) {
          hasAudio = true
          const chunks: MediaChunk[] = []

          entry.audio = { config: audioInfo, chunks }

          try {
            await assertDecoderConfigIsSupported('audio', audioInfo)

            demuxer.setExtractionOptions(audioInfo, (chunk) => chunks.push(chunk))
          } catch {
            // If decoding the audio with WebCodecs isn't supported, decode with an AudioContext instead
            entry.audio.audioBuffer = await getAudioBuffer()
          }
        }

        await demuxer.start(start, end)
      }),
    )

    this.clips.forEach((clip) => {
      const { audio, video } = this.sources.get(clip.source.objectUrl)!

      clip.node.init({ audio, video })
    })

    let encoderError: unknown

    const durationUs = duration * 1e6
    const audioEncoderConfig = {
      numberOfChannels: 2,
      sampleRate: 44100,
      codec: 'opus',
    } as const
    const avEncoder = (this.avEncoder = await new AVEncoder({
      video: hasVideo ? { ...resolution, fps: frameRate } : undefined,
      audio: hasAudio ? { config: audioEncoderConfig } : undefined,
      onOutput: (type, timestamp) => {
        if (type === 'video' || !hasVideo) onProgress?.(timestamp / durationUs)
      },
      onError: (error) => (encoderError = error),
    }).init())

    const { videoContext } = movie
    videoContext.play()
    onProgress?.(0)

    await Promise.all([
      // Video
      (async () => {
        if (!hasVideo) return
        const totalFrames = duration * frameRate
        const frameDurationUs = 1e6 / frameRate

        for (let i = 0; i < totalFrames && encoderError == undefined && !signal?.aborted; i++) {
          const timeS = duration * (i / totalFrames)
          await Promise.all([
            Promise.all(this.clips.map((clip) => clip.node.seekVideo(timeS))),
            avEncoder.whenReadyForVideo(),
          ])

          setObjectSize(movie.gl.canvas, movie.resolution)
          videoContext.currentTime = timeS
          videoContext.update(0)
          const frame = new VideoFrame(canvas, { timestamp: 1e6 * timeS, duration: frameDurationUs })
          avEncoder.encodeVideoFrame(frame)
          frame.close()
        }
      })(),

      // Audio
      (async () => {
        if (!hasAudio) return

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

              if (!node.audioStream) break

              await node.audioStream.read()
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

        avEncoder.encodeAudioData(
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
      })(),
    ])

    await avEncoder.flush()
    if (encoderError != undefined) throw encoderError as Error

    const buffer = avEncoder.finalize()
    return new Blob([buffer], { type: 'video/mp4' })
  }

  dispose() {
    this.tracks.forEach((track) => track.dispose())
    this.sources.clear()
    this.avEncoder?.dispose()

    this.tracks.length = this.clips.length = 0
  }
}
