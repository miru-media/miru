import type { Ref } from 'fine-jsx'

import type { Schema } from '#core'

import type { EditView } from '../src/document-views/edit/edit-nodes.ts'

export interface SchemaTypes {
  track: Schema.Track
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

export interface ClipDrag {
  isDragging: Ref<boolean>
  x: Ref<number>
  targetTrack: Ref<{ id: string; before: boolean } | undefined>
  targetIndex: Ref<number>
  trackType: Schema.Track['trackType'] | undefined
  clip: Ref<EditView.AnyClip | undefined>
  clipWasAloneInTrack: Ref<boolean>
}

export interface ClipResize {
  docDuration: Ref<number>
  isResizing: Ref<boolean>
  clips: [prev?: EditView.AnyClip, self: EditView.AnyClip, next?: EditView.AnyClip]
}
