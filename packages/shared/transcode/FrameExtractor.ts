import { get2dContext, Janitor } from '../utils'

import { type MP4BoxVideoTrack } from './demuxer'

export namespace FrameExtractor {
  export type OnFrame = (frame: VideoFrame | ImageBitmap, sourceTimestamp: number) => void
  export interface Options {
    start: number
    end: number
    track: MP4BoxVideoTrack
    angle: number
  }
}

const getImageSize = (image: VideoFrame | HTMLVideoElement | OffscreenCanvas | HTMLCanvasElement) => {
  if ('codedWidth' in image) return { width: image.codedWidth, height: image.codedHeight }
  if ('videoWidth' in image) return { width: image.videoWidth, height: image.videoHeight }
  return image
}

export abstract class FrameExtractor {
  private abort: AbortController | undefined
  private promise?: Promise<void>
  private context = get2dContext(new OffscreenCanvas(0, 0))
  track: MP4BoxVideoTrack
  startTimeS: number
  endTimeS: number
  angle: number
  has90DegreeRotation: boolean
  fps: number
  frameDurationS: number

  firstFrameTimeUs = -1

  constructor(options: FrameExtractor.Options) {
    this.track = options.track
    this.startTimeS = options.start
    this.endTimeS = options.end
    this.angle = options.angle
    this.has90DegreeRotation = Math.abs(options.angle % 180) !== 0

    const { nb_samples, duration, timescale } = this.track
    this.fps = nb_samples / (duration / timescale)
    this.frameDurationS = 1 / this.fps
  }

  start(onFrame: (frame: VideoFrame, trimmedTimestamp: number) => void, signal?: AbortSignal) {
    this.abort = new AbortController()
    const forwardAbort = () => this.abort?.abort()

    signal?.addEventListener('abort', forwardAbort, { once: true })
    const janitor = new Janitor()
    const startTimeUs = this.startTimeS * 1e6
    const duration = this.frameDurationS * 1e6
    const { angle } = this
    const { width, height } = this.track.video
    const trackIsLandscape = width > height

    this.onImage = function (image, sourceTimeUs: number) {
      if (this.firstFrameTimeUs === -1 && sourceTimeUs >= startTimeUs) this.firstFrameTimeUs = sourceTimeUs

      const { firstFrameTimeUs: firstFrameTimeUs } = this
      const trimmedTimeUs = firstFrameTimeUs === -1 ? -1 : sourceTimeUs - firstFrameTimeUs

      const frameOpions = { timestamp: sourceTimeUs, duration }
      let frame

      if (this.has90DegreeRotation) {
        const size = getImageSize(image)
        const imageIsLandscape = size.width > size.height
        const hasDifferentOrientation = trackIsLandscape !== imageIsLandscape

        const frameSource = hasDifferentOrientation ? this.rotate(image, size, angle) : image
        frame = new VideoFrame(frameSource, frameOpions)
      } else {
        if (image instanceof VideoFrame) frame = image
        else frame = new VideoFrame(image, frameOpions)
      }

      onFrame(frame, trimmedTimeUs)
    }

    this.promise = this._start(this.abort.signal, janitor).finally(() => {
      signal?.removeEventListener('abort', forwardAbort)
      janitor.dispose()
    })
  }

  protected abstract _start(signal: AbortSignal, janitor: Janitor): Promise<void>

  onImage?: (image: VideoFrame | HTMLVideoElement, sourceTimeUs: number) => void

  rotate(image: VideoFrame | HTMLVideoElement, size: { width: number; height: number }, angle: number) {
    const { context } = this
    const { canvas } = context

    canvas.height = size.width
    canvas.width = size.height

    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((angle * Math.PI) / 180)
    context.drawImage(image, -size.width / 2, -size.height / 2)
    context.restore()

    return canvas
  }

  flush() {
    return Promise.resolve(this.promise).finally(() => (this.onImage = undefined))
  }

  stop() {
    this.abort?.abort('`stop()` was called.')
  }
}
