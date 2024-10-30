import Stats from 'stats.js'
import VideoContext from 'videocontext'

import { computed, createEffectScope, effect, Ref, ref, watch } from '@/framework/reactivity'
import { Size } from '@/types'
import { setObjectSize } from '@/utils'

import { Track } from './Track'

const stats = import.meta.env.DEV ? new Stats() : undefined

export const enum VideoContextState {
  PLAYING = 0,
  PAUSED = 1,
  STALLED = 2,
  ENDED = 3,
  BROKEN = 4,
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Movie {
  export interface Init {
    tracks: Track.Init[]
    resolution: Size
  }
}

export class Movie {
  tracks = ref<Track[]>([])
  resolution: Ref<Size>
  displayCanvas = document.createElement('canvas')

  videoContext: VideoContext

  fps = 60

  isEnded = ref(false)
  isPaused = ref(true)
  #scope = createEffectScope()

  #currentTime = ref(0)
  #duration = computed(() => this.tracks.value.reduce((end, track) => Math.max(track.duration, end), 0))

  get state() {
    return this.videoContext.state as VideoContextState
  }

  get duration() {
    return this.#duration.value
  }

  get currentTime() {
    return this.#currentTime.value
  }

  constructor({ tracks = [], resolution }: Movie.Init) {
    this.resolution = ref(resolution)

    this.#scope.run(() => {
      effect(() => {
        setObjectSize(this.displayCanvas, this.resolution.value)
      })
    })

    this.videoContext = new VideoContext(this.displayCanvas)
    this.videoContext.pause()

    this.#scope.run(() => {
      this.tracks.value = tracks.map((t) => new Track(t, this.videoContext))
      watch([this.tracks], ([tracks], _prev, onCleanup) => {
        tracks.forEach((track) => track.node.connect(this.videoContext.destination))
        onCleanup(() => tracks.forEach((track) => track.node.disconnect()))
      })
    })

    const updateState = (currentTime: number) => {
      const { state } = this
      const isEnded = state === VideoContextState.ENDED
      this.isEnded.value = isEnded
      this.isPaused.value = state === VideoContextState.PAUSED || isEnded
      this.#currentTime.value = currentTime
    }
    this.videoContext.registerCallback(VideoContext.EVENTS.UPDATE, updateState)
    this.videoContext.registerCallback(VideoContext.EVENTS.ENDED, updateState)

    if (stats != undefined) {
      stats.showPanel(0)
      document.body.appendChild(stats.dom)
      this.videoContext.registerCallback(VideoContext.EVENTS.UPDATE, () => stats.end())

      Object.values(VideoContext.EVENTS).forEach((type) =>
        // eslint-disable-next-line no-console -- WIP
        this.videoContext.registerCallback(type, () => type !== 'update' && console.log(type)),
      )
    }
  }

  play() {
    this.videoContext.play()
  }

  pause() {
    this.videoContext.pause()
    this.isPaused.value = true
  }

  seekTo(time: number) {
    this.videoContext.currentTime = time
  }

  refresh() {
    this.videoContext.update(0)
  }

  async record() {
    try {
      throw new Error('TODO')
      return await Promise.resolve(new Blob([]))
    } catch (error: unknown) {
      alert(error)
    } finally {
      this.isPaused.value = true
    }
  }
}
