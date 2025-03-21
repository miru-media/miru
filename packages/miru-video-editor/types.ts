import { type Ref } from 'fine-jsx'
import { type Renderer } from 'webgl-effects'

import { type Size } from 'shared/types'

import { type Clip, type Track } from './nodes'
import { type MediaAsset, type VideoEffectAsset } from './nodes/Asset'
import { type Movie } from './nodes/Movie'
import type * as Schema from './nodes/schema'

export interface ClipTime {
  start: number
  source: number
  duration: number
  end: number
}

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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  get<T extends AnyNode>(id: string): T
  set(node: AnyNode): void
}
