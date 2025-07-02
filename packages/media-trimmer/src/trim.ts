import { Trimmer } from './trimmer'
import type * as pub from './types/media-trimmer'

export const trim: typeof pub.trim = async (url: string, options: pub.TrimOptions): Promise<Blob> => {
  const { onProgress } = options
  const trimmer = new Trimmer(url, options)

  if (!onProgress) return await trimmer.trim().finally(() => trimmer.dispose())

  let progress = 0
  let lastProgress = -1
  let rafId = 0

  const rafLoop = () => {
    if (progress !== lastProgress) onProgress(progress)
    lastProgress = progress
    rafId = requestAnimationFrame(rafLoop)
  }
  rafLoop()

  options = { ...options, onProgress: (value) => (progress = value) }

  return await trimmer.trim().finally(() => {
    trimmer.dispose()
    onProgress(progress)
    cancelAnimationFrame(rafId)
  })
}

export default trim
export * from './utils'
