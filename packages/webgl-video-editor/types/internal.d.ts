import type { Schema } from '#core'

export interface SchemaTypes {
  track: Schema.AnyTrack
  clip: Schema.AnyClip
  'asset:media:av': Schema.MediaAsset
  'asset:effect:video': Schema.VideoEffectAsset
}

export interface MediaElementInfo {
  duration: number
  hasAudio: boolean
  width: number
  height: number
}

declare module './core' {
  export interface VideoEditor {
    /** @internal */
    _showStats?: boolean
  }
}

export type NonReadonly<T> = { -readonly [P in keyof T]: T[P] }
export type KeyofUnion<T> = T extends T ? keyof T : never
export type NonOverlappingUnion<T, U> = T & Pick<U, Exclude<keyof U, keyof T>>
export type Valueof<T> = T[KeyofUnion[T]]
