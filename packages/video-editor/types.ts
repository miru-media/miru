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
  getClipTime: () => ClipTime
  renderer: Renderer
  movieIsPaused: Ref<boolean>
}

export type TrackMovie = Pick<Movie, 'videoContext' | 'renderer' | 'resolution' | 'frameRate' | 'isPaused'>
