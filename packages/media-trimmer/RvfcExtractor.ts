import { decodeAsyncImageSource, type Janitor, promiseWithResolvers } from '@/utils'
import { debounce } from 'throttle-debounce'

import { seekAndWait } from '../video-editor/utils'

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

  async _start(onFrame: FrameExtractor.OnFrame, signal: AbortSignal, janitor: Janitor) {
    const { video, startTimeS } = this
    const startTimeUs = startTimeS * 1e6
    const endTimeUs = Math.min(this.endTimeS, video.duration) * 1e6
    const p = promiseWithResolvers()
    const { frameDurationS } = this

    let nextTime = startTimeS
    let prevTimestamp = -Infinity

    const rvfcTimeoutMs = frameDurationS * 2
    const queueForceAdvance = debounce(rvfcTimeoutMs, () => {
      if (video.ended) {
        p.resolve()
        return
      }
      if (video.readyState < 2) return
      video.currentTime = nextTime += frameDurationS / 2
    })
    janitor.add(queueForceAdvance.cancel)

    const advance = () => {
      nextTime += frameDurationS
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

      const frame = new VideoFrame(video)
      const timestamp = video.currentTime * 1e6

      if (prevTimestamp !== -Infinity && timestamp - prevTimestamp > frameDurationS * 1.5 * 1e6)
        // eslint-disable-next-line no-console
        console.warn('[media-trimmer] Skipped a frame before', timestamp)

      if (timestamp >= startTimeUs && timestamp !== prevTimestamp) onFrame(frame, timestamp)
      frame.close()

      prevTimestamp = timestamp
      nextTime = timestamp / 1e6

      if (timestamp >= endTimeUs || video.ended) p.resolve()
      else advance()
    }

    await seekAndWait(video, Math.max(0, startTimeS - frameDurationS), signal)
    if (janitor.isDisposed) return

    janitor.add(() => {
      video.cancelVideoFrameCallback(this.rvfcHandle)
    })
    rvfcLoop()

    await p.promise
  }
}
