import { ref } from '@/framework/reactivity'
import { type Size } from '@/types'
import { remap0 } from '@/utils/math'

import { type Clip } from './Clip'
import { Movie } from './Movie'

export class VideoEditor {
  movie: Movie

  selected = ref<Clip>()
  secondsPerPixel = ref(0.01)
  timelineSize = ref<Size>({ width: 1, height: 1 })
  centerCurrentTime = ref(true)

  constructor(initialState: Movie.Init = { tracks: [], resolution: { width: 1280, height: 720 } }) {
    this.movie = new Movie(initialState)
  }

  addClip() {
    throw new Error('Not Implemented.')
  }

  delete() {
    const clip = this.selected.value
    if (!clip) return

    clip.track.sliceSingleClip(clip)
    clip.dispose()
  }

  setTransition(_from: Clip, _to: Clip, _transition: Clip.Init['transition']) {
    throw new Error('Not Implemented.')
  }
  clearTransition(_from: Clip, _to: Clip) {
    throw new Error('Not Implemented.')
  }

  seekTo(time: number) {
    this.movie.seekTo(time)
  }

  selectClip(clip: Clip | undefined) {
    this.selected.value = clip
  }

  secondsToPixels(time: number) {
    const timelineWidth = this.timelineSize.value.width
    return remap0(time, timelineWidth * this.secondsPerPixel.value, timelineWidth)
  }

  pixelsToSeconds(offset: number) {
    return offset * this.secondsPerPixel.value
  }
}
