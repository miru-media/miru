import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import VideoContext from 'videocontext'

import { Renderer } from 'renderer/Renderer'
import { type DemuxerChunkInfo, type MP4BoxFileInfo, MP4Demuxer } from 'shared/transcode/demuxer'
import { getWebgl2Context, setObjectSize } from 'shared/utils'

import { type Movie } from '../Movie'
import { Track } from '../Track'

import { Encoder } from './Encoder'
import { ExtractorClip } from './ExporterClip'

interface SourceEntry {
  start: number
  end: number
  mute: boolean
  demuxer: MP4Demuxer
  info?: MP4BoxFileInfo
  videoConfig?: VideoDecoderConfig
  width: number
  height: number
  fps: number
  samples: DemuxerChunkInfo[]
}

export class MovieExporter {
  movie: Movie
  gl = getWebgl2Context()
  renderer = new Renderer({ gl: this.gl })
  videoContext!: VideoContext
  tracks: Track<ExtractorClip>[] = []
  clips: ExtractorClip[] = []
  sources = new Map<string, SourceEntry>()
  muxer: Muxer<ArrayBufferTarget>

  constructor(movie: Movie) {
    const { width, height } = movie.resolution

    setObjectSize(this.gl.canvas, movie.resolution)

    this.movie = movie

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height,
      },
      // TODO: audio
      fastStart: 'in-memory',
    })
  }

  async start({ onProgress, signal }: { onProgress?: (value: number) => void; signal?: AbortSignal }) {
    const { movie, renderer, muxer } = this
    const { duration } = movie
    const durationUs = duration * 1e6
    const { canvas } = this.gl

    canvas.getContext = () => this.gl as any
    const videoContext = (this.videoContext = new VideoContext(canvas, undefined, {
      manualUpdate: true,
    }))
    delete (canvas as Partial<typeof canvas>).getContext

    const movieStub = { videoContext, renderer: renderer, resolution: movie.resolution }
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
            mute: true,
            demuxer,
            videoConfig: undefined,
            info: undefined,
            width: 0,
            height: 0,
            fps: 0,
            samples: [],
          }
          this.sources.set(source, sourceEntry)
        }

        sourceEntry.start = Math.min(sourceEntry.start, sourceStart)
        sourceEntry.end = Math.max(sourceEntry.end, sourceEnd)
      }
    })

    await Promise.all(
      Array.from(this.sources.entries()).map(async ([source, entry]) => {
        const { start, end, demuxer, samples } = entry
        const info = (entry.info = await demuxer.init(source))
        const videoTrack = entry.info.videoTracks[0]
        const { width, height } = videoTrack.video
        entry.videoConfig = demuxer.getConfig(videoTrack)
        entry.width = width
        entry.height = height
        entry.fps = videoTrack.nb_samples / (videoTrack.samples_duration / videoTrack.timescale)

        demuxer.setExtractionOptions(info.videoTracks[0], (sample) => samples.push(sample))
        demuxer.start(start, end)
        await demuxer.flush()
      }),
    )

    await Promise.all(
      this.clips.map((clip) => {
        const { samples, videoConfig, fps, width, height } = this.sources.get(clip.source)!
        return clip.node.init({ samples: samples, videoConfig: videoConfig!, fps, width, height })
      }),
    )

    const {
      frameRate: fps,
      resolution: { width, height },
    } = movieInit
    let encoderError: unknown

    const encoder = await new Encoder({
      videoInfo: { width, height, fps: movie.frameRate.value },
      muxer: this.muxer,
      onOutput: (timestamp) => onProgress?.(timestamp / durationUs),
      onError: (error) => (encoderError = error),
    }).init()

    videoContext.play()
    onProgress?.(0)

    const totalFrames = duration * fps
    const frameDurationUs = 1e6 / fps

    try {
      for (let i = 0; i < totalFrames && encoderError == undefined && !signal?.aborted; i++) {
        const timeS = duration * (i / totalFrames)
        await Promise.all([
          Promise.all(this.clips.map((clip) => clip.node.seek(timeS))),
          encoder.encoder && encoder.encoder.encodeQueueSize >= 20
            ? new Promise((resolve) => encoder.encoder?.addEventListener('dequeue', resolve, { once: true }))
            : null,
        ])

        videoContext.update(timeS - videoContext.currentTime)
        encoder.encode(new VideoFrame(canvas, { timestamp: 1e6 * timeS, duration: frameDurationUs }))
      }

      await encoder.flush()
      if (encoderError != undefined) throw encoderError as Error
    } finally {
      encoder.dispose()
    }

    muxer.finalize()
    const { buffer } = muxer.target
    return new Blob([buffer], { type: 'video/mp4' })
  }

  dispose() {
    this.tracks.forEach((track) => track.dispose())
    this.videoContext.reset()
    this.videoContext.destination.destroy()

    this.movie = this.muxer = this.videoContext = undefined as never
    this.tracks.length = this.clips.length = 0
    this.sources.clear()
  }
}
