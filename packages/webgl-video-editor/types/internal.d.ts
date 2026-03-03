import type { AudioClip, ChildNodePosition, Gap, Schema, Timeline, Track, VisualClip } from '#core'

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
    /** @internal @hidden */
    _showStats?: boolean
  }
}

export type NonReadonly<T> = { -readonly [P in keyof T]: T[P] }
