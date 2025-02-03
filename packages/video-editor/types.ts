import { type Ref } from 'fine-jsx'
import { type Renderer } from 'webgl-effects'

import { type Movie } from './Movie'

export interface ClipTime {
  start: number
  source: number
  duration: number
  end: number
}

export interface CustomSourceNodeOptions {
  renderer: Renderer
  movieIsPaused: Ref<boolean>
  movieIsStalled: Ref<boolean>
  getClipTime: () => ClipTime
  getPresentationTime: () => ClipTime
  getPlayableTime: () => ClipTime
}

export type TrackMovie = Pick<Movie, 'videoContext' | 'renderer' | 'resolution' | 'frameRate' | 'isPaused' | 'isStalled'>
