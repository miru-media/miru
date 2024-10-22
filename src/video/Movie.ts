import etro from 'etro'
import Stats from 'stats.js'

import { EffectInternal } from '@/Effect'
import { getDefaultFilters } from '@/effects'
import { computed, createEffectScope, effect, Ref, ref } from '@/framework/reactivity'
import { Renderer } from '@/renderer/Renderer'
import { Size } from '@/types'
import { get2dContext, getWebgl2Context } from '@/utils'

import { Clip } from './Clip'
import { useMappedUniqueArray } from './utils'

interface MovieOptions {
  tracks: TrackOptions[]
  resolution: Size
}

interface TrackOptions {
  clips: Clip.Init[]
}

const stats = import.meta.env.DEV ? new Stats() : undefined

export class Movie {
  tracks: Ref<Track[]>
  resolution: Ref<Size>
  displayCanvas = document.createElement('canvas')

  #renderer = new Renderer({ gl: getWebgl2Context(this.displayCanvas) })
  #scratchPad2d = get2dContext(undefined, { willReadFrequently: true })
  // etro = new etro.Movie({ canvas: this.displayCanvas })
  etro = new EtroMovie(this.#renderer)
  effects = ref(getDefaultFilters().map((e) => new EffectInternal(e, this.#renderer, this.#scratchPad2d)))

  isPaused = ref(true)
  #scope = createEffectScope()

  constructor({ tracks = [], resolution }: MovieOptions) {
    const etroMovie = this.etro

    this.tracks = ref(tracks.map((t) => new Track(t, this.#renderer, etroMovie)))
    this.resolution = ref(resolution)

    this.#scope.run(() => {
      effect(() => {
        const { width, height } = this.resolution.value

        etroMovie.width = width
        etroMovie.height = height
      })
    })
  }

  async play() {
    await this.etro
      .play({ onStart: () => (this.isPaused.value = false) })
      .finally(() => (this.isPaused.value = true))
  }

  pause() {
    this.etro.pause()
    this.isPaused.value = true
  }

  refresh() {
    return this.etro.refresh()
  }

  async record() {
    const video = document.createElement('video')
    const type = ['video/webm', 'video/mp4'].find((type) => video.canPlayType(type))

    try {
      return await (this.etro as unknown as etro.Movie).record({
        frameRate: 60,
        type,
        mediaRecorderOptions: {
          videoBitsPerSecond: 5_000_000,
        },
      })
    } catch (error: unknown) {
      alert(error)
    }
  }
}

const moviePrototype = etro.Movie.prototype as Record<string, any>

class EtroMovie {
  effects: [] = []
  trackClipArraysRefs = ref<Ref<etro.layer.Base[]>[]>([])
  layersRef = computed(() => this.trackClipArraysRefs.value.flatMap((arrayRef) => arrayRef.value))
  _paused = true
  _ended = true
  _rendering = false
  _renderingFrame = false
  _currentTime = 0

  width = 1
  height = 1

  cctx = {
    drawImage() {
      // noop
    },
  }
  actx = new AudioContext()
  #renderer: Renderer

  get canvas() {
    return this.#renderer.canvas
  }
  get _visibleCanvas() {
    return this.canvas
  }
  get currentTime() {
    return this._currentTime
  }
  get layers() {
    return this.layersRef.value
  }

  get paused() {
    return this._paused
  }
  get ready() {
    return this.layers.every((layer) => layer.ready)
  }
  get rendering() {
    return !this.paused || this._renderingFrame
  }
  get renderingFrame() {
    return this._renderingFrame
  }
  get duration(): number {
    return this.layers.reduce((end, layer) => Math.max(layer.startTime + layer.duration, end), 0)
  }

  constructor(renderer: Renderer) {
    this.#renderer = renderer

    if (stats) {
      stats.showPanel(0)
      document.body.appendChild(stats.dom)
    }
  }

  /* eslint-disable @typescript-eslint/no-unsafe-call */
  play(...args: unknown[]) {
    return moviePrototype.play.call(this, ...args) as Promise<void>
  }
  pause() {
    moviePrototype.pause.call(this)
  }
  stop() {
    moviePrototype.stop.call(this)
  }
  refresh() {
    return moviePrototype.refresh.call(this) as Promise<unknown>
  }
  _renderBackground() {
    this.#renderer.clear()
  }
  _render(...args: unknown[]) {
    stats?.begin()
    moviePrototype._render.call(this, ...args)
    stats?.end()
  }

  dispose() {
    this.#renderer = this.actx = undefined as never
    this.trackClipArraysRefs.value.length = this.layersRef.value.length = 0
  }
  /* eslint-enable @typescript-eslint/no-unsafe-call */
}

Object.keys(moviePrototype).forEach((key) => {
  if (key in EtroMovie.prototype) return

  const key_ = key as never

  EtroMovie.prototype[key_] = moviePrototype[key_] as never
})
Object.assign(EtroMovie.prototype)

export class Track {
  clips = ref<Clip[]>([])

  constructor({ clips = [] }: TrackOptions, renderer: Renderer, etroMovie: EtroMovie) {
    this.clips = ref(clips.map((c) => new Clip(c, renderer)))

    etroMovie.layersRef = useMappedUniqueArray(
      this.clips,
      (clip) => {
        const etroVideo = clip.etro.value
        etroVideo.attach(etroMovie as unknown as etro.Movie)
        return etroVideo
      },
      (layer) => layer.detach(),
    )
  }
}
