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
export type Valueof<T> = T[KeyofUnion[T]]

export interface ClipDrag {
  isDragging: Ref<boolean>
  x: Ref<number>
  targetTrack: Ref<{ id: string; before: boolean } | undefined>
}

export interface ClipResize {
  docDuration: Ref<number>
  isResizing: Ref<boolean>
  clips: [prev?: EditView.AnyClip, self: EditView.AnyClip, next?: EditView.AnyClip] | undefined
}
