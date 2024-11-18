import { type Janitor, promiseWithResolvers } from '@/utils'
import { debounce } from 'throttle-debounce'

import { seekAndWait } from '../video-editor/utils'

import { FrameExtractor } from './FrameExtractor'

const RVFC_TIMEOUT_MS = 300

export class RvfcExtractor extends FrameExtractor {
  rvfcHandle = 0
  fps: number
  video: HTMLVideoElement
  startTimeS: number
  endTimeS: number

  constructor(video: HTMLVideoElement, startTimeS: number, endTimeS: number, fps: number) {
    super(startTimeS, endTimeS)

    this.video = video
    this.startTimeS = startTimeS
    this.endTimeS = endTimeS
    this.fps = fps
  }

  async _start(onFrame: FrameExtractor.OnFrame, signal: AbortSignal, janitor: Janitor) {
    const { video, fps, startTimeS } = this
    const startTimeUs = startTimeS * 1e6
    const endTimeUs = Math.min(this.endTimeS, video.duration) * 1e6
    const p = promiseWithResolvers()
    const frameDurationS = 1 / fps
    const frameDurationUs = frameDurationS * 1e6

    let nextTime = startTimeS

    let prevTimestamp = -Infinity

    const queueForceAdvance = debounce(RVFC_TIMEOUT_MS, () => {
      if (video.readyState < 2) return
      video.currentTime = nextTime += frameDurationS
    })
    janitor.add(queueForceAdvance.cancel)

    const advance = () => {
      nextTime += frameDurationS * 0.98
      video.currentTime = nextTime
      this.rvfcHandle = video.requestVideoFrameCallback(rvfcLoop)
      queueForceAdvance()
    }

    const rvfcLoop = () => {
      if (signal.aborted) return

      if (video.readyState < 2) {
        seekAndWait(video, nextTime, signal)
          .then(rvfcLoop)
          .catch(() => undefined)
        return
      }
      const frame = new VideoFrame(video, { timestamp: video.currentTime * 1e6, duration: frameDurationUs })
      const { timestamp } = frame

      if (prevTimestamp !== -Infinity && timestamp - prevTimestamp > frameDurationS * 1.5 * 1e6)
        // eslint-disable-next-line no-console
        console.warn('[media-trimmer] Skipped a frame before', timestamp)

      if (timestamp < startTimeUs || timestamp === prevTimestamp) {
        frame.close()
        advance()
        if (video.ended) p.resolve()
        return
      } else if (timestamp >= endTimeUs || video.ended) {
        p.resolve()
        return
      }

      prevTimestamp = timestamp

      onFrame(frame)
      frame.close()
      advance()
    }

    await seekAndWait(video, Math.max(0, startTimeS - frameDurationS), signal)
    if (janitor.isDisposed) return

    janitor.add(() => video.cancelVideoFrameCallback(this.rvfcHandle))
    rvfcLoop()

    await p.promise
  }
}
