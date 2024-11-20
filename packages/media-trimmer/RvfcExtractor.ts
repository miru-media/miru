import { decodeAsyncImageSource, type Janitor, promiseWithResolvers } from '@/utils'
import { seekAndWait } from 'miru-video-editor/utils'
import { debounce } from 'throttle-debounce'

import { FrameExtractor } from './FrameExtractor'

interface Options extends FrameExtractor.Options {
  crossOrigin?: 'anonymous' | 'use-credentials' | null
}

export class RvfcExtractor extends FrameExtractor {
  rvfcHandle = 0
  video!: HTMLVideoElement
  closeVideo?: () => void

  async init(url: string, crossOrigin: Options['crossOrigin']) {
    const { promise, media, close } = decodeAsyncImageSource(url, crossOrigin, true)

    this.video = media
    this.closeVideo = close
    await promise
  }

  async _start(signal: AbortSignal, janitor: Janitor) {
    janitor.add(() => {
      video.cancelVideoFrameCallback(this.rvfcHandle)
      this.closeVideo?.()
    })

    const { video, startTimeS } = this
    const endTimeS = Math.min(this.endTimeS, video.duration)
    const p = promiseWithResolvers()
    const { frameDurationS } = this

    let nextTime = startTimeS
    let previousTimeS = -1

    const rvfcTimeoutMs = 500
    const queueForceAdvance = debounce(rvfcTimeoutMs, () => {
      if (video.ended) {
        p.resolve()
        return
      }
      if (video.readyState < 2) return
      video.currentTime = nextTime += frameDurationS * 0.25
    })
    janitor.add(queueForceAdvance.cancel)

    const advance = () => {
      nextTime += frameDurationS * 0.999
      video.currentTime = nextTime
      this.rvfcHandle = video.requestVideoFrameCallback(rvfcLoop)
      queueForceAdvance()
    }

    const rvfcLoop = () => {
      if (video.readyState < 2 && !video.ended) {
        seekAndWait(video, nextTime, signal)
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
        (!isAtEndTime || this.firstFrameTimeUs === currentTimesUs)
      ) {
        // const frame = new VideoFrame(video, { timestamp: currentTimesUs, duration: frameDurationS })
        this.onImage!(video, currentTimesUs)
        // frame.close()
      }

      previousTimeS = currentTime
      // will be increased by advance()
      nextTime = currentTime

      if (isAtEndTime || video.ended) p.resolve()
      else advance()
    }

    await seekAndWait(video, Math.max(0, startTimeS - frameDurationS), signal)
    if (janitor.isDisposed) return

    rvfcLoop()

    await p.promise
  }

  flush() {
    return super.flush().finally(() => this.closeVideo?.())
  }
}
