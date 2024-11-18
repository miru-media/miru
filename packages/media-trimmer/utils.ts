import { IS_LIKE_MAC, IS_SAFARI } from '@/constants'

import { MP4Demuxer } from './demuxer'

const hasVideoDecoder = () => typeof VideoDecoder === 'function'
const hasVideoFrame = () => typeof VideoFrame === 'function'
const hasVideoEncoder = () => typeof VideoEncoder === 'function'
const hasRvfc = () =>
  typeof HTMLVideoElement === 'function' &&
  typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function'

export const hasRequiredApis = () => {
  try {
    assertHasRequiredApis()
    return true
  } catch {
    return false
  }
}

export const assertHasRequiredApis = () => {
  if (!(hasVideoDecoder() || hasRvfc()))
    throw new Error('Missing VideoDecoder and requestVideoFrameCallback APIs.')
  if (!hasVideoFrame()) throw new Error('Missing VideoFrame API.')
  if (!hasVideoEncoder()) throw new Error('Missing VideoEncoder support.')
}

export const assertDecoderConfigIsSupported = async (config: VideoDecoderConfig) => {
  if (!hasVideoDecoder()) throw new Error('Missing VideoDecoder API.')
  if (IS_SAFARI && IS_LIKE_MAC) throw new Error(`VideoDecoder doesn't work on Safari.`)
  if (!(await VideoDecoder.isConfigSupported(config)).supported)
    throw new Error(`Decoding config "${config.codec}" is not supported by the user agent.`)
}
export const assertEncoderConfigIsSupported = async (config: VideoEncoderConfig) => {
  if (!(await VideoEncoder.isConfigSupported(config)).supported)
    throw new Error(`Encoding config '${JSON.stringify(config)}' is not supported by the user agent.`)
}

export const getMediaInfo = async (url: string) => {
  const demuxer = new MP4Demuxer()
  let info

  try {
    try {
      info = await demuxer.init(url)
    } catch {
      throw new Error(
        `The media can't be decoded for trimming (${JSON.stringify(info?.videoTracks[0]?.codec ?? 'not an mp4')}).`,
      )
    }

    // check that there's a valid video track
    demuxer.getConfig(info.videoTracks[0])
  } finally {
    demuxer.stop()
  }

  const duration = info.duration / info.timescale
  const hasAudio = info.audioTracks.length > 0
  const { width, height } = info.videoTracks[0]?.video ?? { width: 0, height: 0 }

  return { duration, hasAudio, width, height, containerInfo: info }
}
