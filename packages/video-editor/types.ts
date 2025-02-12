import { type Ref } from 'fine-jsx'
import { type Renderer } from 'webgl-effects'

import { type Effect } from 'reactive-effects/Effect'
import { type Size } from 'shared/types'

import { type Clip } from './Clip'
import { type Movie } from './Movie'

export interface ClipTime {
  start: number
  source: number
  duration: number
  end: number
}

export interface ClipMediaMetadata {
  rotation: number
}

export interface CustomSourceNodeOptions {
  videoEffect?: Ref<Effect | undefined>
  videoEffectIntensity?: Ref<number>
  mediaMetadata: ClipMediaMetadata
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
  'videoContext' | 'renderer' | 'resolution' | 'frameRate' | 'isPaused' | 'isStalled'
>

export interface ClipSnapshot {
  clip: Clip.Init
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
