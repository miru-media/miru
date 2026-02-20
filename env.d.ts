/* eslint-disable @typescript-eslint/triple-slash-reference, @typescript-eslint/consistent-type-imports -- needed for module autmentation */
/// <reference types="vite/client" />
/// <reference types="vitest/client" />
/// <reference types="vitest/config" />
/// <reference types="webxdc-types/global" />
/// <reference types="./auto-imports" />

// remote assets
declare module 'https://*.webm' {
  const src: string
  export default src
}
declare module 'https://*.mp4' {
  const src: string
  export default src
}
declare module 'https://*.mp3' {
  const src: string
  export default src
}
declare module 'https://*.hdr' {
  const src: string
  export default src
}
declare module 'https://*.task' {
  const src: string
  export default src
}

// HDR texture assets
declare module '*.hdr' {
  const src: string
  export default src
}

// glTF files
declare module '*.gltf' {
  const src: string
  export default src
}
declare module '*.glb' {
  const src: string
  export default src
}

declare module '*.vert' {
  const src: string
  export default src
}
declare module '*.frag' {
  const src: string
  export default src
}
declare module '*.glsl' {
  const src: string
  export default src
}

declare module 'virtual:ar-effects-environment-options.js' {
  const environmentOptions: import('./packages/gltf-ar-effects/src/match-environment/environment-matcher').EnvInfo[]
  export default environmentOptions
}

declare module '*.vue' {
  const component: import('vue').Component
  export default component
}

declare module 'postcss-url' {}
declare module 'postcss-import' {}
declare module 'postcss-preset-env' {}
declare module 'postcss-hover-media-feature' {}

declare module '@lokesh.dhakar/quantize' {
  const quantize = (await import('quantize')).default
  export default quantize
}

declare module 'markdown-it-task-lists' {
  const val: any
  export = val
}

declare module 'yjs-orderedtree' {
  const m = await import(
    './node_modules/.pnpm/yjs-orderedtree@1.0.1-beta.3_yjs@13.6.27/node_modules/yjs-orderedtree/dist/types/index'
  )

  export class YTree extends m.YTree {}
}
declare module 'y-webxdc' {
  const val: any
  export = val
}

declare module '@webxdc/vite-plugins' {
  export const buildXDC: () => any
}

declare module 'libavjs-webcodecs-polyfill' {
  const { AudioData, AudioEncoder } = window
  class EncodedAudioChunk_ extends EncodedAudioChunk_ {
    _libavGetData: () => Uint8Array
  }
  const load: (..._args: unknown[]) => Promise<void>
  export { AudioData, AudioEncoder, EncodedAudioChunk_ as EncodedAudioChunk, load }
}
