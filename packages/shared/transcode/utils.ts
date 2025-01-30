import { IS_LIKE_MAC, IS_SAFARI_16 } from '../userAgent'
import { win } from '../utils'

export const hasVideoDecoder = () => typeof VideoDecoder === 'function'
export const hasAudioDecoder = () => typeof AudioDecoder === 'function'
export const hasRvfc = () =>
  typeof HTMLVideoElement === 'function' &&
  typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function'

export const assertDecoderConfigIsSupported = async (
  type: 'audio' | 'video',
  config: AudioDecoderConfig | VideoDecoderConfig,
) => {
  if (type === 'audio') {
    if (!hasAudioDecoder()) throw new Error('Missing AudioDecoder API.')
  } else if (!hasVideoDecoder()) throw new Error('Missing VideoDecoder API.')

  const support = await (type === 'audio'
    ? AudioDecoder.isConfigSupported(config as AudioDecoderConfig)
    : VideoDecoder.isConfigSupported(config as VideoDecoderConfig))

  if (!support.supported)
    throw new Error(`Decoding ${type} config "${config.codec}" is not supported by the user agent.`)
}

export const assertCanExtractVideoFrames = () => {
  if (!hasVideoDecoder() && !hasRvfc())
    throw new Error('Missing VideoDecoder and requestVideoFrameCallback APIs.')
}

export const assertEncoderConfigIsSupported = async (
  type: 'audio' | 'video',
  config: AudioEncoderConfig | VideoEncoderConfig,
  Encoder = type === 'audio' ? win.AudioEncoder : win.VideoEncoder,
) => {
  if (typeof Encoder === 'undefined')
    throw new Error(`Missing ${type === 'audio' ? 'Audio' : 'Video'}Decoder API.`)

  const support = await Encoder.isConfigSupported(config as any)
  if (IS_SAFARI_16 && IS_LIKE_MAC) throw new Error(`VideoEncoder doesn't work on Safari 16.`)

  if (!support.supported)
    throw new Error(`Encoding ${type} config '${JSON.stringify(config)}' is not supported by the user agent.`)
}
