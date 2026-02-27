import type {
  AudioClip,
  Gap,
  MediaAsset,
  Timeline,
  Track,
  VideoEffectAsset,
  VisualClip,
} from '../src/nodes/index.ts'
import type { VideoEditor as VideoEditor_ } from '../src/video-editor.ts'

import type { ChildNodePosition, Schema } from './core.ts'

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
    _editor: VideoEditor_
    /** @internal @hidden */
    _showStats?: boolean
  }
}

export type AnyAsset = MediaAsset | VideoEffectAsset

export type NonReadonly<T> = { -readonly [P in keyof T]: T[P] }
