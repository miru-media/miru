import { get2dContext } from 'shared/utils'
import type { VideoMetadata } from 'shared/video/types'

export namespace FrameExtractor {
  export type OnFrame = (frame: VideoFrame | ImageBitmap, sourceTimestamp: number) => void
  export interface Options {
    start: number
    end: number
    videoInfo: VideoMetadata
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
  private readonly promise?: Promise<void>
  private readonly context = get2dContext(new OffscreenCanvas(0, 0))
  videoInfo: VideoMetadata
  startTimeS: number
  endTimeS: number
  angle: number
  has90DegreeRotation: boolean
  fps: number
  frameDurationS: number

  constructor(options: FrameExtractor.Options) {
    this.videoInfo = options.videoInfo
    this.startTimeS = options.start
    this.endTimeS = options.end
    this.angle = options.angle
    this.has90DegreeRotation = Math.abs(options.angle % 180) !== 0

    const { fps } = this.videoInfo
    this.fps = fps
    this.frameDurationS = 1 / this.fps
  }

  start() {
    this.abort = new AbortController()

    const duration = this.frameDurationS * 1e6
    const { angle } = this
    const { codedWidth: width, codedHeight: height } = this.videoInfo
    const trackIsLandscape = width > height

    this.onImage = function (image, sourceTimeUs: number) {
      const frameOptions = { timestamp: sourceTimeUs, duration: isNaN(duration) ? undefined : duration }
      let frame

      if (this.has90DegreeRotation) {
        const size = getImageSize(image)
        const imageIsLandscape = size.width > size.height
        const hasDifferentOrientation = trackIsLandscape !== imageIsLandscape

        const frameSource = hasDifferentOrientation ? this.rotate(image, size, angle) : image
        frame = new VideoFrame(frameSource, frameOptions)
      } else {
        if (image instanceof VideoFrame) frame = image
        else frame = new VideoFrame(image, frameOptions)
      }

      return frame
    }

    return this._start()
  }

  protected abstract _start(): ReadableStream<VideoFrame>

  onImage?: (image: VideoFrame | HTMLVideoElement, sourceTimeUs: number) => VideoFrame

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

  async flush() {
    return await Promise.resolve(this.promise).finally(() => {
      this.onImage = undefined
    })
  }

  stop() {
    this.abort?.abort('`stop()` was called.')
  }
}
