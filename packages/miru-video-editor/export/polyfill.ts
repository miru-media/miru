import LibAV from '@libav.js/variant-opus'
import { AudioData, AudioEncoder, EncodedAudioChunk, load as loadLibAv } from 'libavjs-webcodecs-polyfill'

// @ts-expect-error -- the file isn't exposed in the package's "exports" field or types
// eslint-disable-next-line import/no-relative-packages
import factory from '../node_modules/@libav.js/variant-opus/dist/libav-6.5.7.1-opus.wasm.mjs'
// eslint-disable-next-line import/no-relative-packages
import wasmurl from '../node_modules/@libav.js/variant-opus/dist/libav-6.5.7.1-opus.wasm.wasm?url'

const libavOptions = { factory, wasmurl, noworker: true, nothreads: true }
Object.assign(LibAV, libavOptions)

let promise: Promise<void> | undefined

export const init = () => {
  return (promise ??= loadLibAv({ LibAV, libavOptions }))
}

export { AudioData, AudioEncoder, EncodedAudioChunk }
