import { debounce } from 'throttle-debounce'

import { Janitor, loadAsyncImageSource } from 'shared/utils'
import { seekAndWait } from 'shared/video/utils'

import { FrameExtractor } from './FrameExtractor'

interface Options extends FrameExtractor.Options {
  crossOrigin?: 'anonymous' | 'use-credentials' | null
}

export class RvfcExtractor extends FrameExtractor {
  url: string
  crossOrigin: Options['crossOrigin']
  rvfcHandle = 0
  video!: HTMLVideoElement
  closeVideo?: () => void
  janitor = new Janitor()

  constructor(url: string, options: Options) {
    super(options)
    this.url = url
  }

  _start(): ReadableStream<VideoFrame> {
    const abort = new AbortController()
    this.janitor.add(abort.abort.bind(abort))

    return new ReadableStream({
      start: async (controller) => {
        const { promise, close } = loadAsyncImageSource(this.url, this.crossOrigin, true)

        this.video = await promise
        this.closeVideo = close

        this.janitor.add(() => {
          video.cancelVideoFrameCallback(this.rvfcHandle)
          close()
        })

        const { video, startTimeS } = this
        const endTimeS = Math.min(this.endTimeS, video.duration)
        const { frameDurationS } = this

        let nextTime = startTimeS
        let previousTimeS = -1

        const rvfcTimeoutMs = 500
        const queueForceAdvance = debounce(rvfcTimeoutMs, () => {
          if (video.ended) {
            controller.close()
            return
          }
          if (video.readyState < 2) return
          video.currentTime = nextTime += frameDurationS * 0.25
        })
        this.janitor.add(queueForceAdvance.cancel)

        const advance = () => {
          nextTime += frameDurationS * 0.999
          video.currentTime = nextTime
          this.rvfcHandle = video.requestVideoFrameCallback(rvfcLoop)
          queueForceAdvance()
        }

        let hasGottenFrame = false

        const rvfcLoop = () => {
          if (video.readyState < 2 && !video.ended) {
            seekAndWait(video, nextTime, abort.signal)
              .then(rvfcLoop)
              .catch(() => undefined)
            return
          }

          const { currentTime } = video
          const currentTimesUs = Math.trunc(currentTime * 1e6)
          const isAtEndTime = currentTime >= endTimeS

          if (previousTimeS !== -1 && currentTime - previousTimeS > frameDurationS * 1.5)
            // eslint-disable-next-line no-console
            console.warn('[media-trimmer] Skipped a frame before', currentTime)

          if (
            currentTime >= startTimeS &&
            currentTime !== previousTimeS &&
            (!isAtEndTime || !hasGottenFrame)
          ) {
            hasGottenFrame = true
            controller.enqueue(this.onImage!(video, currentTimesUs))
          }

          previousTimeS = currentTime
          // will be increased by advance()
          nextTime = currentTime

          if (isAtEndTime || video.ended) controller.close()
          else advance()
        }

        await seekAndWait(video, Math.max(0, startTimeS - frameDurationS), abort.signal)
        if (this.janitor.isDisposed) return

        rvfcLoop()
      },
      cancel: () => {
        this.janitor.dispose()
      },
    })
  }

  flush() {
    return super.flush().finally(() => this.closeVideo?.())
  }
}
