import LibAV from '@libav.js/variant-opus'
import { AudioData, AudioEncoder, EncodedAudioChunk, load as loadLibAv } from 'libavjs-webcodecs-polyfill'

let promise: Promise<void> | undefined

export const init = () => (promise ??= loadLibAv({ LibAV }))

export { AudioData, AudioEncoder, EncodedAudioChunk }
