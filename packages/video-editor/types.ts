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

export interface CustomSourceNodeOptions {
  videoEffect?: Ref<Effect | undefined>
  videoEffectIntensity?: Ref<number>
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
  // create
  | { type: 'clip:update'; from: undefined; to: ClipSnapshot }
  // upate
  | { type: 'clip:update'; from: ClipSnapshot; to: ClipSnapshot }
  // delete
  | { type: 'clip:update'; from: ClipSnapshot; to: undefined }
