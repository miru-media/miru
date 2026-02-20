import { Trimmer } from './trimmer.ts'
import type * as pub from './types/media-trimmer.ts'

export const trim: typeof pub.trim = async (
  source: string | Blob,
  options: pub.TrimOptions,
): Promise<Blob> => {
  const { onProgress } = options
  const trimmer = new Trimmer(source, options)

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
export * from './utils.ts'
