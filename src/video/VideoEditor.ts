import { effect, type Ref, ref } from '@/framework/reactivity'
import { type Size } from '@/types'
import { useElementSize } from '@/utils'
import { remap0 } from '@/utils/math'

import { type Clip } from './Clip'
import { Movie } from './Movie'
import { Track } from './Track'
import { getVideoInfo } from './utils'

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

  resize = ref<{ movieDuration: number }>()
  drag = ref({ isDragging: false, x: 0 })
  #mediaSources = new Map<string, { refCount: 0; blob?: Blob }>()

  showStats = ref(import.meta.env.DEV)

  constructor(
    initialState: Movie.Init = {
      tracks: [{ clips: [] }],
      resolution: { width: 1280, height: 720 },
      frameRate: 60,
    },
  ) {
    this.movie = new Movie(initialState)
    this.movie.tracks.value.forEach((track) =>
      track.forEachClip((clip) => this.#incrementMediaSource(clip.media.value.src)),
    )
    this.canvasSize = useElementSize(this.movie.displayCanvas)

    effect(() => {
      const { movie } = this
      if (!movie.tracks.value.length) {
        movie.tracks.value = [new Track({ clips: [] }, movie)]
      }
    })
  }

  async addClip(track: Track, source: string | Blob) {
    const url = this.#incrementMediaSource(source)

    const { duration } = await getVideoInfo(source)

    const clip = track.createClip({
      sourceStart: 0,
      duration,
      source: url,
      transition: undefined,
    })

    track.pushSingleClip(clip)
  }

  async replaceClipSource(source: string | Blob) {
    const { duration } = await getVideoInfo(source)
    const clip = this.selected.value
    if (!clip) return

    const url = this.#incrementMediaSource(source)
    this.#decrementMediaSource(clip.media.value.src)
    clip.duration.value = Math.min(duration, clip.duration.value)
    clip.setMedia(url)
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

    const newClip = clip.track.createClip({
      sourceStart: prevClipTime.source + delta,
      duration: prevClipTime.duration - delta,
      source: clip.media.value.src,
      transition: clip.transition,
    })

    clip.transition = undefined
    clip.duration.value = delta
    clip.track.insertClipBefore(newClip, clip.next)

    this.#incrementMediaSource(clip.media.value.src)
    this.selectClip(clip)
  }

  delete() {
    const clip = this.selected.value
    if (!clip) return

    this.#decrementMediaSource(clip.media.value.src)
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

  #incrementMediaSource(source: string | Blob) {
    let url
    let blob
    if (typeof source === 'string') {
      url = source
      blob = undefined
    } else {
      url = URL.createObjectURL(source)
      blob = source
    }
    const entry = this.#mediaSources.get(url) ?? { refCount: 0, blob }
    entry.refCount++
    this.#mediaSources.set(url, entry)

    return url
  }

  #decrementMediaSource(url: string) {
    const entry = this.#mediaSources.get(url)
    if (!entry) return

    entry.refCount--

    if (entry.refCount <= 0) {
      this.#mediaSources.delete(url)
      if (entry.blob) URL.revokeObjectURL(url)
    }
  }
}
