import type { Ref } from 'fine-jsx'

import type { AudioClip, ChildNodePosition, Gap, Schema, Timeline, Track, VisualClip } from '#core'

import type { EditAudioClip, EditVisualClip } from '../src/document-views/edit/edit-nodes.ts'

export interface SchemaTypes {
  track: Schema.Track
  clip: Schema.AnyClip
  'asset:media:av': Schema.MediaAsset
  'asset:effect:video': Schema.VideoEffectAsset
}

export interface NodeSnapshot<T extends Schema.AnyNodeSchema = Schema.AnyNodeSchema> {
  node: T
  position?: ChildNodePosition
}

export interface MediaElementInfo {
  duration: number
  hasAudio: boolean
  width: number
  height: number
}

export interface NodesByType {
  timeline: Timeline
  track: Track
  clip: VisualClip | AudioClip
  gap: Gap
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
  clips:
    | [
        prev?: EditVisualClip | EditAudioClip,
        self: EditVisualClip | EditAudioClip,
        next?: EditVisualClip | EditAudioClip,
      ]
    | undefined
}
