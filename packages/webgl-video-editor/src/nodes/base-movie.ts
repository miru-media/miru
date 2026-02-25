import { computed, effect, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { setObjectSize } from 'shared/utils'
import { clamp } from 'shared/utils/math'

import type * as pub from '../../types/core.d.ts'
import type { VideoEditorEvents } from '../../types/events'
import type { AnyAsset, AnyClip, AnyNode, NodeMap as INodeMap } from '../../types/internal'
import { VideoEffectAsset } from '../assets.ts'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION, ROOT_NODE_ID } from '../constants.ts'
import {
  type AssetCreateEvent,
  type AssetDeleteEvent,
  type NodeCreateEvent,
  type NodeDeleteEvent,
  PlaybackSeekEvent,
} from '../events.ts'
import { PlaybackPauseEvent, PlaybackPlayEvent } from '../events.ts'
import { LutUploaderSystem } from '../pixi/pixi-lut-source.ts'

import type { BaseNode, Gap, Schema } from './index.ts'
import { ParentNode } from './parent-node.ts'
import { Timeline } from './timeline.ts'
import type { Track } from './track.ts'

export const enum PlaybackState {
  ERROR = -1,
  PLAYING = 0,
  PAUSED = 1,
  STALLED = 2,
  ENDED = 3,
}

const PLAY_EVENT = new PlaybackPlayEvent()
const PAUSE_EVENT = new PlaybackPauseEvent()
const SEEK_EVENT = new PlaybackSeekEvent()

Pixi.extensions.add(LutUploaderSystem)

class NodeMap implements INodeMap {
  map = new Map<string, AnyNode | BaseNode>()
  byType = {
    movie: new Set<BaseMovie>(),
    timeline: new Set<Timeline>(),
    track: new Set<Track>(),
    clip: new Set<AnyClip>(),
    gap: new Set<Gap>(),
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- false positive
  get<T extends AnyNode>(id: string): T {
    return this.map.get(id) as T
  }
  set(node: AnyNode | BaseNode): void {
    this.map.set(node.id, node)
    ;(this.byType as Record<string, Set<BaseNode>>)[node.type].add(node)
  }
  has(id: string): boolean {
    return this.map.has(id)
  }
  delete(id: string): boolean {
    const node = this.map.get(id)
    if (!node) return true
    ;(this.byType as Record<string, Set<BaseNode>>)[node.type].delete(node)
    return this.map.delete(id)
  }
}

const createInitialAssets = (movie: BaseMovie) =>
  getDefaultFilterDefinitions().forEach(
    (def, index): VideoEffectAsset =>
      new VideoEffectAsset(
        {
          ...def,
          id: def.id ?? index.toString(),
          type: 'asset:effect:video',
        },
        movie,
      ),
  )

export abstract class BaseMovie extends ParentNode<Schema.Movie, Timeline> implements pub.Movie {
  type = 'movie' as const
  declare parent?: undefined
  declare root: this
  declare container: undefined

  nodes = new NodeMap()
  declare assets: Map<string, AnyAsset>

  declare canvas: HTMLCanvasElement | OffscreenCanvas
  declare gl: WebGL2RenderingContext
  declare renderer: Pixi.WebGLRenderer
  declare whenRendererIsReady: Promise<void>
  readonly #createdOwnRenderer: boolean

  get stage(): Pixi.Container {
    return this.timeline.container
  }

  protected readonly _currentTime = ref(0)
  readonly #duration = computed(() =>
    this.timeline.children.reduce((end, track) => Math.max(track.duration, end), 0),
  )

  isEnded = computed(() => this.currentTime >= this.duration)
  isPaused = ref(true)
  isStalled = computed(() => !this.isPaused.value && !this.isReady)

  declare resolution: Schema.Movie['resolution']
  declare frameRate: Schema.Movie['frameRate']

  readonly #eventTarget = new EventTarget()
  readonly #disposeAbort = new AbortController()

  readonly activeClipIsStalled = computed(() => {
    for (let track = this.timeline.head; track; track = track.next)
      for (let clip = track.firstClip; clip; clip = clip.nextClip)
        if (!clip.isReady && clip.isInClipTime) return true
    return false
  })
  abstract get isReady(): boolean

  get duration(): number {
    return this.#duration.value
  }

  get currentTime(): number {
    return this._currentTime.value
  }

  timeline!: Timeline

  constructor(options: Partial<Pick<BaseMovie, 'gl' | 'renderer' | 'assets' | 'resolution' | 'frameRate'>>) {
    super({
      resolution: options.resolution ?? DEFAULT_RESOLUTION,
      frameRate: options.frameRate ?? DEFAULT_FRAMERATE,
      id: ROOT_NODE_ID,
      type: 'movie',
    })

    if (options.renderer) {
      this.renderer = options.renderer
      this.gl = options.renderer.gl
      this.#createdOwnRenderer = false
    } else {
      const { gl } = options
      if (!gl) throw new Error('[webgl-video-editor] options.gl or options.renderer must be provided.')

      this.gl = gl
      this.renderer = new Pixi.WebGLRenderer()
      this.#createdOwnRenderer = true
    }

    this.canvas = this.gl.canvas

    this.on('node:create', ({ node }: NodeCreateEvent) => this.nodes.set(node))
    this.on('node:delete', ({ node }: NodeDeleteEvent) => this.nodes.delete(node.id))
    this.on('asset:create', ({ asset }: AssetCreateEvent) => this.assets.set(asset.id, asset))
    this.on('asset:delete', ({ asset }: AssetDeleteEvent) => this.assets.delete(asset.id))

    this.timeline = new Timeline({ id: Timeline.TIMELINE, type: Timeline.TIMELINE }, this)

    setObjectSize(this.canvas, this.resolution)
    this.whenRendererIsReady = this.#createdOwnRenderer ? this.#initPixi() : Promise.resolve()

    if (options.assets) this.assets = options.assets
    else {
      this.assets = new Map<string, AnyAsset>()
      createInitialAssets(this)
    }

    this.onDispose(() => {
      if (this.#createdOwnRenderer) this.renderer.destroy()
      this.stage.destroy()
      this.#disposeAbort.abort()
    })
  }

  protected _init(init: pub.Schema.Movie): void {
    this.root = this

    this._defineReactive('resolution', init.resolution, {
      onChange: this._onChangeResolution.bind(this),
    })
    this._defineReactive('frameRate', init.frameRate)
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- --
  isMovie(): this is BaseMovie {
    return true
  }

  async #initPixi(): Promise<void> {
    try {
      const { renderer, gl, canvas } = this
      await renderer.init({ context: gl, canvas })

      const { width, height } = this.resolution
      renderer.resize(width, height)
    } catch (error) {
      this._emit(new ErrorEvent('error', { error }))
    }
  }

  protected _onChangeResolution() {
    const { renderer, resolution } = this
    if ((renderer as Partial<typeof renderer> | undefined)?.view)
      renderer.resize(resolution.width, resolution.height)
  }

  play(): void {
    if (this.isEnded.value) this.seekTo(0)
    if (this.isPaused.value) {
      this._emit(PLAY_EVENT)
      this.isPaused.value = false
    }
  }

  pause(): void {
    if (!this.isPaused.value) {
      this._emit(PAUSE_EVENT)
      this.isPaused.value = true
    }
  }

  seekTo(time: number): void {
    const { duration } = this
    this._currentTime.value = clamp(time, 0, duration)
    this._emit(SEEK_EVENT)
  }

  async whenReady(): Promise<void> {
    if (this.isReady) return

    await new Promise<void>((resolve) => {
      const stop = effect(() => {
        if (!this.isReady) return
        stop()
        resolve()
      })
    })
  }

  get isEmpty(): boolean {
    return this.timeline.children.every((track) => track.count === 0)
  }

  toObject(): Schema.Movie {
    return {
      id: this.id,
      type: this.type,
      resolution: this.resolution,
      frameRate: this.frameRate,
    }
  }

  on<T extends Extract<keyof VideoEditorEvents, string>>(
    type: T,
    listener: (event: VideoEditorEvents[T]) => void,
    options?: AddEventListenerOptions,
  ): () => void {
    this.#eventTarget.addEventListener(type, listener as any, options)
    const remove = () =>
      this.#eventTarget.removeEventListener(type, listener as any, {
        signal: this.#disposeAbort.signal,
        ...options,
      })
    return remove
  }

  /** @internal @hidden */
  _emit(event: VideoEditorEvents[keyof VideoEditorEvents]): void {
    this.#eventTarget.dispatchEvent(event)
  }
}
