import Stats from 'stats.js'
import VideoContext from 'videocontext'

import { computed, createEffectScope, effect, type Ref, ref, watch } from '@/framework/reactivity'
import { Renderer } from '@/renderer/Renderer'
import { type Size } from '@/types'
import { getWebgl2Context, setObjectSize } from '@/utils'

import { Track } from './Track'

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
    frameRate: number
  }
}

export class Movie {
  tracks = ref<Track[]>([])
  resolution: Ref<Size>
  frameRate: Ref<number>
  displayCanvas = document.createElement('canvas')
  #gl = getWebgl2Context(this.displayCanvas)
  renderer = new Renderer({ gl: this.#gl })

  videoContext: VideoContext

  isEnded = ref(false)
  isPaused = ref(true)
  #scope = createEffectScope()

  #currentTime = ref(0)
  #duration = computed(() => this.tracks.value.reduce((end, track) => Math.max(track.duration, end), 0))

  stats = new Stats()

  get state() {
    return this.videoContext.state as VideoContextState
  }

  get duration() {
    return this.#duration.value
  }

  get currentTime() {
    return this.#currentTime.value
  }

  constructor({ tracks = [], resolution, frameRate }: Movie.Init) {
    const canvas = this.displayCanvas
    // force webgl2 context
    canvas.getContext = ((_id, _options) => this.#gl) as typeof canvas.getContext

    this.resolution = ref(resolution)
    this.frameRate = ref(frameRate)

    this.#scope.run(() => {
      effect(() => {
        setObjectSize(this.displayCanvas, this.resolution.value)
      })
    })

    const videoContext = (this.videoContext = new VideoContext(this.displayCanvas))
    videoContext.pause()

    this.#scope.run(() => {
      this.tracks.value = tracks.map((t) => new Track(t, this))
      watch([() => this.tracks.value.map((t) => t.node.value)], ([trackNodes], _prev, onCleanup) => {
        trackNodes.forEach((node) => node.connect(videoContext.destination))
        onCleanup(() => trackNodes.forEach((node) => node.disconnect()))
      })
    })

    const updateState = (currentTime: number) => {
      const { state } = this
      const isEnded = state === VideoContextState.ENDED
      this.isEnded.value = isEnded
      this.isPaused.value = state === VideoContextState.PAUSED || isEnded
      this.#currentTime.value = currentTime
    }
    videoContext.registerCallback(VideoContext.EVENTS.UPDATE, updateState)
    videoContext.registerCallback(VideoContext.EVENTS.ENDED, updateState)

    this.stats.showPanel(0)
    const _update = videoContext._update.bind(videoContext)
    this.videoContext._update = (dt) => {
      const isPlaying = !this.isPaused.value

      if (isPlaying) this.stats.begin()
      _update(dt)
      if (isPlaying) this.stats.end()
    }

    Object.values(VideoContext.EVENTS).forEach((type) =>
      // eslint-disable-next-line no-console -- WIP
      this.videoContext.registerCallback(type, () => type !== 'update' && console.log(type)),
    )
  }

  play() {
    this.videoContext.play()
  }

  pause() {
    this.videoContext.pause()
    this.isPaused.value = true
  }

  seekTo(time: number) {
    this.videoContext.currentTime = this.#currentTime.value = time
    // reschedule playback of VideoContext source nodes
    this.tracks.value.forEach((track) => track.forEachClip((clip) => clip.schedule()))
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
