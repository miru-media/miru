import { Janitor } from '@/utils'

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FrameExtractor {
  export type OnFrame = (frame: VideoFrame) => void
}

export abstract class FrameExtractor {
  private abort: AbortController | undefined
  private promise?: Promise<void>
  startTimeS: number
  endTimeS: number
  firstFrameTimestamp = -1

  constructor(startTimeS: number, endTimeS: number) {
    this.startTimeS = startTimeS
    this.endTimeS = endTimeS
  }

  start(onFrame: (frame: VideoFrame, trimmedTimestamp: number) => void, signal?: AbortSignal) {
    this.abort = new AbortController()
    const forwardAbort = () => this.abort?.abort()

    signal?.addEventListener('abort', forwardAbort, { once: true })
    const janitor = new Janitor()
    const startTimeUs = this.startTimeS * 1e6

    const onFrame_: FrameExtractor.OnFrame = (frame) => {
      if (this.firstFrameTimestamp === -1 && frame.timestamp >= startTimeUs)
        this.firstFrameTimestamp = frame.timestamp

      const { firstFrameTimestamp } = this
      const trimmedTimestamp = firstFrameTimestamp === -1 ? -1 : frame.timestamp - firstFrameTimestamp

      onFrame(frame, trimmedTimestamp)
    }

    this.promise = this._start(onFrame_, this.abort.signal, janitor).finally(() => {
      signal?.removeEventListener('abort', forwardAbort)
      janitor.dispose()
    })
  }

  protected abstract _start(
    onFrame: FrameExtractor.OnFrame,
    signal: AbortSignal,
    janitor: Janitor,
  ): Promise<void>

  flush() {
    return Promise.resolve(this.promise)
  }

  stop() {
    this.abort?.abort('`stop()` was called.')
  }
}
