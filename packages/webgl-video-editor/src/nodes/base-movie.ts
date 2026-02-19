import { computed, effect, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { setObjectSize } from 'shared/utils'
import { clamp } from 'shared/utils/math'

import type * as pub from '../../types/core.d.ts'
import type { VideoEditorEvents } from '../../types/events'
import type { AnyAsset, AnyNode, NodeMap as INodeMap } from '../../types/internal'
import { VideoEffectAsset } from '../assets.ts'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION, ROOT_NODE_ID } from '../constants.ts'
import {
  type AssetCreateEvent,
  type AssetDeleteEvent,
  NodeCreateEvent,
  type NodeDeleteEvent,
  PlaybackSeekEvent,
} from '../events.ts'
import { PlaybackPauseEvent, PlaybackPlayEvent } from '../events.ts'
import { LutUploaderSystem } from '../pixi/pixi-lut-source.ts'

import type { BaseClip, BaseNode, Schema } from './index.ts'
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
    clip: new Set<BaseClip>(),
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
  declare parent?: never
  declare readonly root: this
  type = 'movie' as const

  nodes = new NodeMap()
  assets: Map<string, AnyAsset>
  tracks = new Set<Track>()

  canvas: HTMLCanvasElement | OffscreenCanvas
  gl: WebGL2RenderingContext
  renderer: Pixi.WebGLRenderer
  stage: Pixi.Container
  whenRendererIsReady: Promise<void>
  readonly #createdOwnRenderer: boolean

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

  abstract get isReady(): boolean

  get duration(): number {
    return this.#duration.value
  }

  get currentTime(): number {
    return this._currentTime.value
  }

  readonly timeline: Timeline

  constructor(options: Partial<Pick<BaseMovie, 'gl' | 'renderer' | 'assets' | 'resolution' | 'frameRate'>>) {
    super(ROOT_NODE_ID)
    this.root = this

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
    this.stage = new Pixi.Container()

    this._defineReactive('resolution', options.resolution ?? DEFAULT_RESOLUTION, {
      onChange: (value) => {
        const { renderer } = this
        if ((renderer as Partial<typeof renderer>).view !== undefined)
          renderer.resize(value.width, value.height)
      },
    })
    this._defineReactive('frameRate', options.frameRate ?? DEFAULT_FRAMERATE)

    this.on('node:create', ({ node }: NodeCreateEvent) => this.nodes.set(node))
    this.on('node:delete', ({ node }: NodeDeleteEvent) => this.nodes.delete(node.id))
    this.on('asset:create', ({ asset }: AssetCreateEvent) => this.assets.set(asset.id, asset))
    this.on('asset:delete', ({ asset }: AssetDeleteEvent) => this.assets.delete(asset.id))

    this._emit(new NodeCreateEvent(this))
    this.timeline = new Timeline({ id: Timeline.TIMELINE }, this)

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

  async whenReady() {
    await new Promise<void>((resolve) => {
      if (this.isReady) return

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

  on<T extends VideoEditorEvents[string]>(
    type: T['type'],
    listener: (event: T) => void,
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
