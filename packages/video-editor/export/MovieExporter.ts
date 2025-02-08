import { ref } from 'fine-jsx'
import VideoContext from 'videocontext'
import { Renderer } from 'webgl-effects'

import { type DemuxerChunkInfo, type MP4BoxFileInfo, MP4Demuxer } from 'shared/transcode/demuxer'
import { assertDecoderConfigIsSupported } from 'shared/transcode/utils'
import { getWebgl2Context, setObjectSize } from 'shared/utils'

import { type Movie } from '../Movie'
import { Track } from '../Track'
import { type TrackMovie } from '../types'

import { AVEncoder } from './AVEncoder'
import { ExtractorClip } from './ExporterClip'
import { type Mp4ExtractorNode } from './Mp4ExtractorNode'

interface SourceEntry {
  start: number
  end: number
  demuxer: MP4Demuxer
  info?: MP4BoxFileInfo
  audio?: Mp4ExtractorNode.AudioInit
  video?: Mp4ExtractorNode.VideoInit
  isAudioOnly: boolean
}

let audioContext: AudioContext | undefined

export class MovieExporter {
  movie: Movie
  gl = getWebgl2Context()
  renderer = new Renderer({ gl: this.gl })
  videoContext!: VideoContext
  tracks: Track<ExtractorClip>[] = []
  clips: ExtractorClip[] = []
  sources = new Map<string, SourceEntry>()
  avEncoder?: AVEncoder

  constructor(movie: Movie) {
    setObjectSize(this.gl.canvas, movie.resolution)

    this.movie = movie
  }

  async start({ onProgress, signal }: { onProgress?: (value: number) => void; signal?: AbortSignal }) {
    const { movie, renderer } = this
    const { duration, resolution } = movie
    const frameRate = movie.frameRate.value
    const { canvas } = this.gl

    canvas.getContext = () => this.gl as any
    const videoContext = (this.videoContext = new VideoContext(canvas, undefined, { manualUpdate: true }))
    delete (canvas as Partial<typeof canvas>).getContext

    const movieStub: TrackMovie = {
      videoContext,
      renderer,
      resolution,
      frameRate: movie.frameRate,
      isPaused: ref(false),
      isStalled: ref(false),
    }
    const movieInit = movie.toObject()

    movieInit.tracks.forEach((init) => {
      const track = new Track(init, movieStub, ExtractorClip)

      for (let clip = track.head; clip; clip = clip.next) {
        this.clips.push(clip)

        const { source } = clip
        const { source: sourceStart, duration } = clip.time
        const sourceEnd = sourceStart + duration
        let sourceEntry = this.sources.get(source)

        if (!sourceEntry) {
          const demuxer = new MP4Demuxer()
          sourceEntry = {
            start: sourceStart,
            end: sourceEnd,
            demuxer,
            info: undefined,
            video: undefined,
            audio: undefined,
            isAudioOnly: track.type === 'audio',
          }
          this.sources.set(source, sourceEntry)
        } else {
          sourceEntry.isAudioOnly &&= track.type === 'audio'
        }

        sourceEntry.start = Math.min(sourceEntry.start, sourceStart)
        sourceEntry.end = Math.max(sourceEntry.end, sourceEnd)
      }
    })

    let hasAudio = false as boolean
    await Promise.all(
      Array.from(this.sources.entries()).map(async ([source, entry]) => {
        const getAudioBuffer = async () => {
          const encodedFileData = await fetch(source).then((r) => r.arrayBuffer())
          return await (audioContext ??= new AudioContext()).decodeAudioData(encodedFileData)
        }

        const { start, end, demuxer } = entry
        let info: MP4BoxFileInfo

        try {
          info = entry.info = await demuxer.init(source)
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

        const videoTrack = info.videoTracks[0]
        const audioTrack = info.audioTracks[0] as (typeof info.audioTracks)[number] | undefined

        if (!entry.isAudioOnly) {
          const chunks: DemuxerChunkInfo[] = []
          const config = demuxer.getConfig(videoTrack)
          await assertDecoderConfigIsSupported('video', config)

          entry.video = { config, chunks }
          demuxer.setExtractionOptions(videoTrack, (chunk) => chunks.push(chunk))
        }

        if (audioTrack) {
          hasAudio = true
          const chunks: DemuxerChunkInfo[] = []
          const config = demuxer.getConfig(audioTrack)

          entry.audio = { config, chunks }

          try {
            await assertDecoderConfigIsSupported('audio', config)

            demuxer.setExtractionOptions(audioTrack, (chunk) => chunks.push(chunk))
          } catch {
            // If decoding the audio with WebCodecs isn't supported, decode with an AudioContext instead
            entry.audio.audioBuffer = await getAudioBuffer()
          }
        }

        demuxer.start(start, end)
        await demuxer.flush()
      }),
    )

    this.clips.forEach((clip) => {
      const { audio, video } = this.sources.get(clip.source)!

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
      video: { ...resolution, fps: frameRate },
      audio: hasAudio ? { config: audioEncoderConfig } : undefined,
      onOutput: (timestamp) => onProgress?.(timestamp / durationUs),
      onError: (error) => (encoderError = error),
    }).init())

    videoContext.play()
    onProgress?.(0)

    await Promise.all([
      // Video
      (async () => {
        const totalFrames = duration * frameRate
        const frameDurationUs = 1e6 / frameRate

        for (let i = 0; i < totalFrames && encoderError == undefined && !signal?.aborted; i++) {
          const timeS = duration * (i / totalFrames)
          await Promise.all([
            Promise.all(this.clips.map((clip) => clip.node.seekVideo(timeS))),
            avEncoder.whenReadyForVideo(),
          ])

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
    this.videoContext.reset()
    this.videoContext.destination.destroy()
    this.sources.clear()
    this.avEncoder?.dispose()

    this.movie = this.videoContext = undefined as never
    this.tracks.length = this.clips.length = 0
  }
}
