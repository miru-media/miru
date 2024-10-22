/// <reference types="vite/client" />

declare module 'virtual:shadow.css' {
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

declare module 'postcss-url' {}
declare module 'postcss-import' {}
declare module 'postcss-hover-media-feature' {}
declare module 'eslint-plugin-import' {
  const val: any
  export = val
}
