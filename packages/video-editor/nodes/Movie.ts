import { computed, createEffectScope, effect, type Ref, ref, watch } from 'fine-jsx'
import Stats from 'stats.js'
import { uid } from 'uid'
import VideoContext from 'videocontext'
import { getDefaultFilterDefinitions, Renderer } from 'webgl-effects'

import { type Size } from 'shared/types'
import { getWebgl2Context, setObjectSize, useDocumentVisibility } from 'shared/utils'

import { ASSET_URL_REFRESH_TIMEOUT_MS } from '../constants'
import { type AnyNode, type NodeMap as NodeMapType } from '../types'
import { useRafLoop } from '../utils'

import { type Schema } from '.'

import { MediaAsset, VideoEffectAsset } from './Asset'
import { Clip } from './Clip'
import { ParentNode } from './ParentNode'
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
    children: Schema.Track[]
    resolution: Size
    frameRate: number
  }
}

class NodeMap implements NodeMapType {
  map = new Map<string, Movie | Track<Clip> | Clip | MediaAsset | VideoEffectAsset>()
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  get<T extends AnyNode>(id: string) {
    return this.map.get(id) as T
  }
  set(node: AnyNode) {
    this.map.set(node.id, node)
  }
  delete(id: string) {
    return this.map.delete(id)
  }
}

export class Movie extends ParentNode {
  #children = ref<Track<Clip>[]>([])
  frameRate: Ref<number>
  displayCanvas = document.createElement('canvas')
  gl = getWebgl2Context(this.displayCanvas)
  renderer = new Renderer({ gl: this.gl })

  videoContext: VideoContext

  isEnded = ref(false)
  isPaused = ref(true)
  isStalled = ref(false)
  #scope = createEffectScope()

  #currentTime = ref(0)
  #duration = computed(() => this.children.reduce((end, track) => Math.max(track.duration, end), 0))
  #resolution = ref({ width: 400, height: 400 / (9 / 16) })
  #noRender = ref(0)
  nodes = new NodeMap()

  assets = new Set<MediaAsset | VideoEffectAsset>()
  effects = ref<VideoEffectAsset[]>()

  stats = new Stats()

  #state = ref<VideoContextState>(VideoContextState.STALLED)

  get children() {
    return this.#children.value
  }
  set children(children: Track<Clip>[]) {
    this.#children.value = children
  }

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
    return this.children.every((track) => track.toArray().every((clip) => clip.isReady))
  }

  get duration() {
    return this.#duration.value
  }

  get currentTime() {
    return this.#currentTime.value
  }

  constructor({ id, children: tracks = [], resolution, frameRate }: Schema.Movie) {
    super(id, undefined)
    this.root = this
    const canvas = this.displayCanvas

    this.resolution = resolution
    this.frameRate = ref(frameRate)

    // force webgl2 context
    canvas.getContext = ((_id, _options) => this.gl) as typeof canvas.getContext
    const videoContext = (this.videoContext = new VideoContext(this.displayCanvas, undefined, {
      manualUpdate: true,
    }))
    delete (canvas as Partial<typeof canvas>).getContext

    videoContext.pause()

    this.clearAllContent()

    this.#scope.run(() => {
      // create tracks
      this.#children.value = tracks.map((t) => new Track(t, this, Clip))

      // keep VideoContext nodes connected
      watch([() => this.children.map((t) => t.node.value)], ([trackNodes], _prev, onCleanup) => {
        trackNodes.forEach((node) => node.connect(videoContext.destination))
        onCleanup(() => trackNodes.forEach((node) => node.disconnect()))
      })

      watch([this.isStalled], ([stalled], _prev, onCleanup) => {
        if (!stalled) return

        const timeoutId = setTimeout(
          () =>
            this.assets.forEach((asset) => {
              if (asset.type === 'av_media_asset') asset.refreshObjectUrl().catch(() => undefined)
            }),
          ASSET_URL_REFRESH_TIMEOUT_MS,
        )
        onCleanup(() => clearTimeout(timeoutId))
      })
    })

    const updateState = (currentTime: number) => {
      const state = (this.#state.value = this.videoContext.state as VideoContextState)
      const isEnded = state === VideoContextState.ENDED
      this.isEnded.value = isEnded
      this.isPaused.value = state === VideoContextState.PAUSED || isEnded
      this.isStalled.value = state === VideoContextState.STALLED
      this.#currentTime.value = currentTime
    }
    Object.values(VideoContext.EVENTS).forEach((type) =>
      this.videoContext.registerCallback(type, updateState),
    )

    this.stats.showPanel(0)
    const _update = videoContext._update.bind(videoContext)
    this.videoContext._update = (dt) => {
      const isPlaying = !this.isPaused.value
      const { displayCanvas } = this
      const { width, height } = this.resolution

      if (displayCanvas.width !== width) displayCanvas.width = width
      if (displayCanvas.height !== height) displayCanvas.height = height

      if (isPlaying) this.stats.begin()

      if (!this.#noRender.value) _update(dt)

      if (isPlaying) this.stats.end()
    }

    const documentIsVisible = useDocumentVisibility()
    let lastRafTime = performance.now()
    const getLoopIsActive = () => !this.#noRender.value && documentIsVisible.value
    effect(() => {
      if (getLoopIsActive()) lastRafTime = performance.now()
    })

    useRafLoop(
      (time) => {
        const dt = (time - lastRafTime) / 1e3
        if (dt > 0) videoContext._update(dt)
        lastRafTime = time
      },
      { active: getLoopIsActive },
    )

    if (import.meta.env.DEV)
      Object.values(VideoContext.EVENTS).forEach((type) =>
        // eslint-disable-next-line no-console -- WIP
        this.videoContext.registerCallback(type, () => type !== 'update' && console.info(type)),
      )
  }

  play() {
    if (this.#noRender.value) return

    if (this.isEnded.value) this.seekTo(0)

    this.isPaused.value = false
    this.videoContext.play()
    this.isPaused.value = this.videoContext.state !== 0
  }

  pause() {
    this.isPaused.value = true
    this.videoContext.pause()
  }

  seekTo(time: number) {
    this.videoContext.currentTime = this.#currentTime.value = time
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
    return this.children.every((track) => track.count === 0)
  }

  refresh() {
    this.videoContext.update(0)
  }

  async withoutRendering(fn: () => Promise<void>) {
    this.#noRender.value++
    await fn().finally(() => this.#noRender.value--)
  }

  toObject(): Schema.Movie {
    const assets = Array.from(this.assets).map((asset) => asset.toObject())

    return {
      id: this.id,
      type: 'movie',
      assets,
      children: this.children.map((t) => t.toObject()),
      resolution: this.resolution,
      frameRate: this.frameRate.value,
    }
  }

  clearAllContent(clearCache: true): Promise<void>
  clearAllContent(clearCache?: false): void
  clearAllContent(clearCache = false): Promise<void> | void {
    this.assets.forEach((asset) => asset.dispose())
    this.assets.clear()
    this.children.forEach((child) => child.dispose())
    this.#children.value = [
      new Track({ id: uid(), type: 'track', trackType: 'video', children: [] }, this, Clip),
    ]

    this.effects.value = getDefaultFilterDefinitions().map((def, i) => {
      const { id = i.toString() } = def
      const effect = new VideoEffectAsset({ ...def, id }, this.renderer)
      this.nodes.set(effect)
      return effect
    })

    if (clearCache) return MediaAsset.clearCache().then(() => undefined)
  }

  _dispose() {
    super._dispose()
    this.videoContext.destination.destroy()
    this.#scope.stop()
  }
}
