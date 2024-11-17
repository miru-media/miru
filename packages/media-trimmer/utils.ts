import { IS_LIKE_MAC, IS_SAFARI } from '@/constants'
import { win } from '@/utils'

import { MP4Demuxer } from './demuxer'

export const hasRequiredApis = () => {
  const { VideoDecoder, VideoEncoder } = win as Partial<typeof win>
  return !!VideoDecoder && !!VideoEncoder
}

export const assertDecoderConfigIsSupported = async (config: VideoDecoderConfig) => {
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
      info = (await demuxer.init(url)).info
    } catch {
      throw new Error(
        `The media can't be decoded for trimming (${JSON.stringify(info?.videoTracks[0]?.codec ?? 'not an mp4')}).`,
      )
    }

    await assertDecoderConfigIsSupported(demuxer.getConfig(info.videoTracks[0]))
  } finally {
    demuxer.stop()
  }

  const duration = info.duration / info.timescale
  const hasAudio = info.audioTracks.length > 0
  const { width, height } = info.videoTracks[0]?.video ?? { width: 0, height: 0 }

  return { duration, hasAudio, width, height, containerInfo: info }
}
