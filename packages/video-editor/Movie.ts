import { computed, createEffectScope, effect, type Ref, ref, watch } from 'fine-jsx'
import Stats from 'stats.js'
import VideoContext from 'videocontext'

import { Renderer } from 'renderer/Renderer'
import { type Size } from 'shared/types'
import { getWebgl2Context, setObjectSize } from 'shared/utils'

import { Clip } from './Clip'
import { MovieExporter } from './export/MovieExporter'
import { Track } from './Track'

export const enum VideoContextState {
  PLAYING = 0,
  PAUSED = 1,
  STALLED = 2,
  ENDED = 3,
  BROKEN = 4,
}

export namespace Movie {
  export interface Init {
    tracks: Track.Init[]
    resolution: Size
    frameRate: number
  }
}

export class Movie {
  tracks = ref<Track<Clip>[]>([])
  frameRate: Ref<number>
  displayCanvas = document.createElement('canvas')
  gl = getWebgl2Context(this.displayCanvas)
  renderer = new Renderer({ gl: this.gl })

  videoContext: VideoContext

  isEnded = ref(false)
  isPaused = ref(true)
  #scope = createEffectScope()

  #currentTime = ref(0)
  #duration = computed(() => this.tracks.value.reduce((end, track) => Math.max(track.duration, end), 0))
  #resolution: Ref<Size>

  stats = new Stats()

  #state = ref<VideoContextState>(VideoContextState.STALLED)

  get resolution() {
    return this.#resolution.value
  }

  set resolution(size) {
    this.#resolution.value = size
    setObjectSize(this.displayCanvas, size)
  }

  get isReady() {
    const state = this.#state.value
    if (state === VideoContextState.STALLED || state === VideoContextState.BROKEN) return false
    return this.tracks.value.every((track) => track.toArray().every((clip) => clip.isReady))
  }

  get duration() {
    return this.#duration.value
  }

  get currentTime() {
    return this.#currentTime.value
  }

  constructor({ tracks = [], resolution, frameRate }: Movie.Init) {
    const canvas = this.displayCanvas

    this.#resolution = ref(resolution)
    this.frameRate = ref(frameRate)

    // force webgl2 context
    canvas.getContext = ((_id, _options) => this.gl) as typeof canvas.getContext
    const videoContext = (this.videoContext = new VideoContext(this.displayCanvas))
    delete (canvas as Partial<typeof canvas>).getContext

    videoContext.pause()

    this.#scope.run(() => {
      this.tracks.value = tracks.map((t) => new Track(t, this, Clip))
      watch([() => this.tracks.value.map((t) => t.node.value)], ([trackNodes], _prev, onCleanup) => {
        trackNodes.forEach((node) => node.connect(videoContext.destination))
        onCleanup(() => trackNodes.forEach((node) => node.disconnect()))
      })
    })

    const updateState = (currentTime: number) => {
      const state = (this.#state.value = this.videoContext.state as VideoContextState)
      const isEnded = state === VideoContextState.ENDED
      this.isEnded.value = isEnded
      this.isPaused.value = state === VideoContextState.PAUSED || isEnded
      this.#currentTime.value = currentTime
    }
    Object.values(VideoContext.EVENTS).forEach((type) =>
      this.videoContext.registerCallback(type, updateState),
    )

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
      this.videoContext.registerCallback(type, () => type !== 'update' && console.info(type)),
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

  whenReady() {
    return new Promise<void>((resolve, reject) => {
      if (this.isReady) return
      if (this.#state.value === VideoContextState.BROKEN) reject(new Error('Broken VideoContext state'))

      const stop = effect(() => {
        if (!this.isReady) return
        stop()
        resolve()
      })
    })
  }

  get isEmpty() {
    return this.tracks.value.every((track) => track.count === 0)
  }

  refresh() {
    this.videoContext.update(0)
  }

  toObject(): Movie.Init {
    return {
      tracks: this.tracks.value.map((t) => t.toObject()),
      resolution: this.resolution,
      frameRate: this.frameRate.value,
    }
  }

  async export(options: { onProgress?: (value: number) => void; signal?: AbortSignal }) {
    this.pause()
    const exporter = new MovieExporter(this)

    try {
      options.onProgress?.(0)
      return await exporter.start(options)
    } finally {
      exporter.dispose()
    }
  }
}
