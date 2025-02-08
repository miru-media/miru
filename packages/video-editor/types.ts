import { type Ref } from 'fine-jsx'
import { type Renderer } from 'webgl-effects'

import { type Effect } from 'reactive-effects/Effect'
import { type Size } from 'shared/types'

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
