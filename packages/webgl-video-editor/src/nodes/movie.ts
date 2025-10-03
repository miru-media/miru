import { computed, createEffectScope, effect, ref, watch } from 'fine-jsx'
import Stats from 'stats.js'
import VideoContext from 'videocontext'
import { Renderer } from 'webgl-effects'

import type { Size } from 'shared/types'
import { getWebgl2Context, setObjectSize, useDocumentVisibility } from 'shared/utils'
import { clamp } from 'shared/utils/math'
import { useRafLoop } from 'shared/video/utils'

import type { AnyNode, NodeMap as INodeMap } from '../../types/internal'
import {
  ASSET_URL_REFRESH_TIMEOUT_MS,
  DEFAULT_FRAMERATE,
  DEFAULT_RESOLUTION,
  ROOT_NDOE_ID,
} from '../constants.ts'
import { NodeCreateEvent, type VideoEditorEvents } from '../events.ts'

import { MediaAsset, VideoEffectAsset } from './assets.ts'
import { Collection } from './collection.ts'
import { type BaseNode, Clip, type Schema } from './index.ts'
import { ParentNode } from './parent-node.ts'
import { Track } from './track.ts'

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

class NodeMap implements INodeMap {
  map = new Map<string, AnyNode | BaseNode>()
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- false positive
  get<T extends AnyNode>(id: string): T {
    return this.map.get(id) as T
  }
  set(node: AnyNode | BaseNode): void {
    this.map.set(node.id, node)
  }
  has(id: string): boolean {
    return this.map.has(id)
  }
  delete(id: string): boolean {
    return this.map.delete(id)
  }
}

export class Movie extends ParentNode<Schema.Movie, Collection<'asset-library'> | Collection<'timeline'>> {
  declare parent?: never

  type = 'movie' as const
  canvas = document.createElement('canvas')
  gl = getWebgl2Context(this.canvas)
  renderer = new Renderer({ gl: this.gl })
  declare readonly root: this

  videoContext: VideoContext

  isEnded = ref(false)
  isPaused = ref(true)
  isStalled = ref(false)
  readonly #scope = createEffectScope()

  readonly #currentTime = ref(0)
  readonly #duration = computed(
    () => this.#timeline.value?.children.reduce((end, track) => Math.max(track.duration, end), 0) ?? 0,
  )
  readonly #noRender = ref(0)
  nodes = new NodeMap()

  stats = new Stats()

  readonly #state = ref<VideoContextState>(VideoContextState.STALLED)

  readonly #eventTarget = new EventTarget()

  declare resolution: Schema.Movie['resolution']
  declare frameRate: Schema.Movie['frameRate']

  get isReady(): boolean {
    const state = this.#state.value
    if (state === VideoContextState.STALLED || state === VideoContextState.BROKEN) return false
    return (
      this.#timeline.value?.children.every((track) => track.children.every((clip) => clip.isReady)) ?? true
    )
  }

  get duration(): number {
    return this.#duration.value
  }

  get currentTime(): number {
    return this.#currentTime.value
  }

  readonly #assetsLibrary = computed(() =>
    this.children.find((child) => child.isKind(Collection.ASSET_LIBRARY)),
  )
  get assetLibrary(): Collection<'asset-library'> {
    return this.#assetsLibrary.value!
  }

  readonly #timeline = computed(() => this.children.find((child) => child.isKind(Collection.TIMELINE)))

  get timeline(): Collection<'timeline'> {
    const timeline = this.#timeline.value
    if (!timeline) throw new Error(`[webgl-video-editor] Missing timeline collection node.`)
    return timeline
  }

  constructor() {
    super(ROOT_NDOE_ID)
    this.root = this
    this.nodes.set(this)

    this._defineReactive('resolution', DEFAULT_RESOLUTION, {
      onChange: setObjectSize.bind(null, this.canvas),
    })
    this._defineReactive('frameRate', DEFAULT_FRAMERATE)

    this._emit(new NodeCreateEvent(this.id))

    const { canvas } = this

    // force webgl2 context
    canvas.getContext = ((_id, _options) => this.gl) as typeof canvas.getContext
    const videoContext = (this.videoContext = new VideoContext(this.canvas, undefined, {
      manualUpdate: true,
    }))
    delete (canvas as Partial<typeof canvas>).getContext

    videoContext.pause()

    this.#scope.run(() => {
      // keep VideoContext nodes connected in the right order
      watch(
        [() => this.#timeline.value?.children.map((t) => t._node.value)],
        ([trackNodes], _prev, onCleanup) => {
          if (!trackNodes) return
          trackNodes.forEach((node) => node.connect(videoContext.destination))
          onCleanup(() => trackNodes.forEach((node) => node.disconnect()))
        },
      )

      watch([this.isStalled], ([stalled], _prev, onCleanup) => {
        if (!stalled) return

        const timeoutId = setTimeout(
          () =>
            this.assetLibrary.children.forEach((asset) => {
              if (asset.type === 'asset:media:av') void asset._refreshObjectUrl()
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
      const { canvas } = this
      const { width, height } = this.resolution

      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height

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

    this.onDispose(() => {
      this.videoContext.destination.destroy()
      this.#scope.stop()
    })
  }

  createNode<T extends Schema.AnyNodeSchema>(init: T) {
    let node: AnyNode

    switch (init.type) {
      case 'collection':
        node = new Collection(init, this)
        break
      case 'track':
        node = new Track(init, this)
        break
      case 'clip':
        node = new Clip(init, this)
        break
      case 'asset:media:av':
        node = MediaAsset.fromInit(init, this)
        break
      case 'asset:effect:video':
        node = new VideoEffectAsset(init, this)
        break
      default:
        throw new Error(`[webgl-video-editor] Unexpected ${init.type} init.`)
    }

    type TCollectionKind = Extract<T, Schema.Collection>['kind']
    return node as {
      movie: Movie
      collection: Collection<TCollectionKind>
      track: Track
      clip: Clip
      'asset:media:av': MediaAsset
      'asset:effect:video': VideoEffectAsset
    }[T['type']]
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
    const { duration } = this
    this.#currentTime.value = clamp(time, 0, duration)
    // clamp to exclude 0 and the movie duration so that a frame is always rendered
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- TODO
    this.videoContext.currentTime = clamp(time, 0.0001, duration - 0.001)
  }

  async whenReady() {
    await new Promise<void>((resolve, reject) => {
      if (this.isReady) return
      if (this.#state.value === VideoContextState.BROKEN) reject(new Error('Broken VideoContext state'))

      const stop = effect(() => {
        if (!this.isReady) return
        stop()
        resolve()
      })
    })
  }

  get isEmpty(): boolean {
    return this.#timeline.value?.children.every((track) => track.count === 0) ?? true
  }

  refresh(): void {
    this.videoContext.update(0)
  }

  async withoutRendering(fn: () => Promise<void>): Promise<void> {
    this.#noRender.value++
    await fn().finally(() => this.#noRender.value--)
  }

  toObject(): Schema.Movie {
    return {
      id: this.id,
      type: this.type,
      resolution: this.resolution,
      frameRate: this.frameRate,
    }
  }

  clearAllContent(clearCache: true): Promise<void>
  clearAllContent(clearCache?: false): void
  clearAllContent(clearCache = false): Promise<void> | void {
    this.children.forEach((collection) => {
      while (collection.tail) collection.tail.dispose()
    })

    this.renderer.clear()

    if (clearCache) return MediaAsset.clearCache().then(() => undefined)
  }

  on<T extends keyof VideoEditorEvents>(
    type: T,
    listener: (event: VideoEditorEvents[T]) => void,
    options?: AddEventListenerOptions,
  ): () => void {
    this.#eventTarget.addEventListener(type, listener as any, options)
    return () => this.#eventTarget.removeEventListener(type, listener as any, options)
  }

  /** @internal @hidden */
  _emit(event: VideoEditorEvents[keyof VideoEditorEvents]): void {
    this.#eventTarget.dispatchEvent(event)
  }
}
