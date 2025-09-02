import LibAV from '@libav.js/variant-opus'
import { AudioData, AudioEncoder, EncodedAudioChunk, load as loadLibAv } from 'libavjs-webcodecs-polyfill'

/* eslint-disable import/no-relative-packages -- -- */
// @ts-expect-error -- the file isn't exposed in the package's "exports" field or types
import factory from '../../node_modules/@libav.js/variant-opus/dist/libav-6.8.8.0-opus.wasm.mjs'
import wasmurl from '../../node_modules/@libav.js/variant-opus/dist/libav-6.8.8.0-opus.wasm.wasm?url'
/* eslint-enable import/no-relative-packages */

const libavOptions = { factory, wasmurl, noworker: true, nothreads: true }
Object.assign(LibAV, libavOptions)

let promise: Promise<void> | undefined

export const init = () => (promise ??= loadLibAv({ LibAV, libavOptions }))

export { AudioData, AudioEncoder, EncodedAudioChunk }
