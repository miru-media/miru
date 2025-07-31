import type { Ref } from 'fine-jsx'
import type { Renderer } from 'webgl-effects'

import type { Size } from 'shared/types'

import type { Clip, MediaAsset, Movie, Track, VideoEffectAsset } from '../src/nodes/index.ts'

import type { Schema } from './core.ts'

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

export interface ClipSnapshot {
  clip: Schema.Clip
  id: string
  trackId: string
  index: number
}

export type HistoryOp =
  // upsert
  | { type: 'clip:update'; group?: string; from: undefined; to: ClipSnapshot }
  // upate
  | { type: 'clip:update'; group?: string; from: ClipSnapshot; to: ClipSnapshot }
  // delete
  | { type: 'clip:update'; group?: string; from: ClipSnapshot; to: undefined }

export interface MediaElementInfo {
  duration: number
  hasAudio: boolean
  width: number
  height: number
}

export type AnyNode = Movie | Track<Clip> | Clip | MediaAsset | VideoEffectAsset

export interface NodeMap {
  map: Map<string, AnyNode>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- false positive
  get: <T extends AnyNode>(id: string) => T
  set: (node: AnyNode) => void
}

declare module './core' {
  export interface Clip {
    /** @internal */
    _presentationTime: ClipTime
  }

  export interface VideoEditor {
    /** @internal */
    _showStats?: boolean
  }
}
