import { MP4Demuxer } from 'shared/transcode/demuxer'
import { assertCanExtractVideoFrames } from 'shared/transcode/utils'
import { IS_LIKE_MAC, IS_SAFARI_16, IS_SAFARI_17 } from 'shared/userAgent'

const hasVideoEncoder = () => typeof VideoEncoder === 'function'

export const hasRequiredApis = () => {
  try {
    assertHasRequiredApis()
    return true
  } catch {
    return false
  }
}

export const assertHasRequiredApis = () => {
  if ((IS_SAFARI_16 || IS_SAFARI_17) && IS_LIKE_MAC)
    throw new Error(`VideoEncoder doesn't work on Safari <= 17.`)

  assertCanExtractVideoFrames()
  if (!hasVideoEncoder()) throw new Error('Missing VideoEncoder support.')
}

export const getMediaInfo = async (url: string) => {
  const demuxer = new MP4Demuxer()
  const abort = new AbortController()
  let info

  try {
    try {
      info = await demuxer.init(url, { signal: abort.signal })
    } catch {
      throw new Error(
        `The media can't be decoded for trimming (${JSON.stringify(info?.videoTracks[0]?.codec ?? 'not an mp4')}).`,
      )
    }

    // check that there's a valid video track
    demuxer.getConfig(info.videoTracks[0])
  } finally {
    demuxer.stop()
    abort.abort()
  }

  const duration = info.duration / info.timescale
  const hasAudio = info.audioTracks.length > 0
  const { width, height } = info.videoTracks[0]?.video ?? { width: 0, height: 0 }

  return { duration, hasAudio, width, height, containerInfo: info }
}
