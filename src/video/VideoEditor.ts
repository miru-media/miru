import { effect, type Ref, ref } from '@/framework/reactivity'
import { type Size } from '@/types'
import { useElementSize } from '@/utils'
import { remap0 } from '@/utils/math'

import { Clip } from './Clip'
import { Movie } from './Movie'
import { Track } from './Track'

const getClipAtTime = (track: Track, time: number) => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start < time && time < clipTime.end) return clip
  }
}

export class VideoEditor {
  movie: Movie

  selected = ref<Clip>()
  secondsPerPixel = ref(0.01)
  timelineSize = ref<Size>({ width: 1, height: 1 })
  canvasSize: Ref<Size>

  stateBeforeClipResize = ref<{
    movieDuration: number
    inTransitionDuration: number
    outTransitionDuration: number
  }>()

  constructor(initialState: Movie.Init = { tracks: [], resolution: { width: 1280, height: 720 } }) {
    this.movie = new Movie(initialState)
    this.canvasSize = useElementSize(this.movie.displayCanvas)

    effect(() => {
      const { movie } = this
      if (!movie.tracks.value.length) {
        movie.tracks.value = [new Track({ clips: [] }, movie.videoContext, movie.renderer)]
      }
    })
  }

  addClip() {
    throw new Error('Not Implemented.')
  }

  splitAtCurrentTime() {
    const { currentTime } = this.movie
    const trackOfSelectedClip = this.selected.value?.track

    // first search the track that contains a selected clip
    let clip = trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)

    if (!clip) {
      // then search all tracks for a clip at the current time
      for (const track of this.movie.tracks.value) {
        clip = getClipAtTime(track, currentTime)
        if (clip) break
      }
    }

    if (!clip) return

    const delta = currentTime - clip.time.start
    const prevClipTime = clip.time

    const newClip = new Clip(
      {
        sourceStart: prevClipTime.source + delta,
        duration: prevClipTime.duration - delta,
        source: clip.media.value.src,
        transition: undefined,
      },
      this.movie.videoContext,
      clip.track,
      this.movie.renderer,
    )

    if (clip.transition) {
      const { type, duration } = clip.transition
      newClip.transition = { type, duration: Math.min(duration, newClip.time.duration) }
    }
    clip.transition = undefined
    clip.duration.value = delta
    clip.track.insertClipBefore(newClip, clip.next)

    this.selectClip(newClip)
  }

  delete() {
    const clip = this.selected.value
    if (!clip) return

    clip.track.sliceClip(clip)
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
