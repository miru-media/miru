import { IS_LIKE_MAC, IS_SAFARI_16 } from '../userAgent'

export const hasVideoDecoder = () => typeof VideoDecoder === 'function'
export const hasRvfc = () =>
  typeof HTMLVideoElement === 'function' &&
  typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function'

export const assertDecoderConfigIsSupported = async (config: VideoDecoderConfig) => {
  if (!hasVideoDecoder()) throw new Error('Missing VideoDecoder API.')
  if (IS_SAFARI_16 && IS_LIKE_MAC) throw new Error(`VideoEncoder doesn't work on Safari 16.`)
  if (!(await VideoDecoder.isConfigSupported(config)).supported)
    throw new Error(`Decoding config "${config.codec}" is not supported by the user agent.`)
}

export const assertCanExtractVideoFrames = () => {
  if (!hasVideoDecoder() && !hasRvfc())
    throw new Error('Missing VideoDecoder and requestVideoFrameCallback APIs.')
}

export const assertEncoderConfigIsSupported = async (config: VideoEncoderConfig) => {
  if (!(await VideoEncoder.isConfigSupported(config)).supported)
    throw new Error(`Encoding config '${JSON.stringify(config)}' is not supported by the user agent.`)
}
