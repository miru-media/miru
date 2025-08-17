import type { Ref } from 'fine-jsx'
import type { Renderer } from 'webgl-effects'

import type { Size } from 'shared/types'

import type { ExportMovie } from '../src/export/export-movie.ts'
import type {
  BaseNode,
  Clip,
  Collection,
  MediaAsset,
  Movie,
  Track,
  VideoEffectAsset,
} from '../src/nodes/index.ts'
import type { VideoEditor as VideoEditor_ } from '../src/video-editor.ts'

import type { ChildNodePosition, Schema } from './core.ts'
import type { CollectionKind } from './schema'

export interface CustomSourceNodeOptions {
  videoEffect?: Ref<VideoEffectAsset | undefined>
  videoEffectIntensity?: Ref<number>
  source: Schema.AvMediaAsset
  renderer: Renderer
  movieIsPaused: Ref<boolean>
  movieIsStalled: Ref<boolean>
  movieResolution: Ref<Size>
  getClipTime: () => ClipTime
  getPresentationTime: () => ClipTime
  getPlayableTime: () => ClipTime
}

export type TrackMovie = Pick<
  Movie,
  'id' | 'nodes' | 'videoContext' | 'renderer' | 'resolution' | 'frameRate' | 'isPaused' | 'isStalled'
>

export interface SchemaTypes {
  track: Schema.Track
  clip: Schema.Clip
  'asset:media:av': Schema.MediaAsset
  'asset:effect:video': Schema.VideoEffectAsset
}

export interface NodeSnapshot<T extends Schema.AnyNodeSchema = Schema.AnyNodeSchema> {
  node: T
  id: string
  position?: ChildNodePosition
}

export interface MediaElementInfo {
  duration: number
  hasAudio: boolean
  width: number
  height: number
}

export type AnyNode = Movie | Collection<CollectionKind> | Track | Clip | MediaAsset | VideoEffectAsset

export interface NodeMap {
  map: Map<string, AnyNode | BaseNode>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- false positive
  get: <T extends AnyNode>(id: string) => T
  set: (node: AnyNode | BaseNode) => void
  has: (id: string) => boolean
  delete: (id: string) => void
}

declare module './core' {
  export interface Clip {
    /** @internal */
    _presentationTime: ClipTime
  }

  export interface VideoEditor {
    /** @internal @hidden */
    _editor: VideoEditor_
    /** @internal @hidden */
    _showStats?: boolean
  }
}

export type RootNode = Movie | ExportMovie

export type NonReadonly<T> = { -readonly [P in keyof T]: T[P] }
