import { computed, effect, ref, type Ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import type { Size } from 'shared/types.ts'
import { clamp } from 'shared/utils/math'

import type * as pub from '../types/core'
import type { VideoEditorEvents } from '../types/events'
import type { AnyAsset, AnyClip, AnyNode, NodeMap as INodeMap, NodesByType } from '../types/internal'

import { VideoEffectAsset } from './assets.ts'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION } from './constants.ts'
import {
  type AssetCreateEvent,
  type AssetDeleteEvent,
  type NodeCreateEvent,
  type NodeDeleteEvent,
  PlaybackSeekEvent,
  SettingsUpdateEvent,
} from './events.ts'
import { PlaybackPauseEvent, PlaybackPlayEvent } from './events.ts'
import type { Gap, Schema } from './nodes/index.ts'
import { Timeline } from './nodes/timeline.ts'
import type { Track } from './nodes/track.ts'
import { LutUploaderSystem } from './pixi/pixi-lut-source.ts'

const PLAY_EVENT = new PlaybackPlayEvent()
const PAUSE_EVENT = new PlaybackPauseEvent()
const SEEK_EVENT = new PlaybackSeekEvent()

Pixi.extensions.add(LutUploaderSystem)

class NodeMap implements INodeMap {
  map = new Map<string, AnyNode>()
  byType = {
    timeline: new Set<Timeline>(),
    track: new Set<Track>(),
    clip: new Set<AnyClip>(),
    gap: new Set<Gap>(),
  }
  get<T extends AnyNode>(id: T['id']): T {
    return this.map.get(id) as T
  }
  set(node: AnyNode): void {
    this.map.set(node.id, node)
    const typeSet: Set<NodesByType[typeof node.type]> = this.byType[node.type]
    typeSet.add(node)
  }
  has(id: string): boolean {
    return this.map.has(id)
  }
  delete(id: string): boolean {
    const node = this.map.get(id)
    if (!node) return true

    const typeSet: Set<NodesByType[typeof node.type]> = this.byType[node.type]
    typeSet.delete(node)

    return this.map.delete(id)
  }
}

const createInitialAssets = (doc: Document) =>
  getDefaultFilterDefinitions().forEach(
    (def, index): VideoEffectAsset =>
      new VideoEffectAsset(
        {
          ...def,
          id: def.id ?? index.toString(),
          type: 'asset:effect:video',
        },
        doc,
      ),
  )

export abstract class Document implements pub.Document {
  declare parent?: undefined
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

  readonly #resolution: Ref<Size>
  readonly #frameRate: Ref<number>

  get resolution(): Size {
    return this.#resolution.value
  }
  set resolution(value) {
    this.#resolution.value = value
    const prev = this.resolution

    const { width, height } = value
    const { renderer } = this
    if ((renderer as Partial<typeof renderer> | undefined)?.view) renderer.resize(width, height)
    this._emit(new SettingsUpdateEvent({ resolution: prev }))
  }
  get frameRate(): number {
    return this.#frameRate.value
  }
  set frameRate(value) {
    const prev = this.frameRate
    this.#frameRate.value = value
    this._emit(new SettingsUpdateEvent({ frameRate: prev }))
  }

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

  timeline: Timeline

  constructor(
    options: Partial<
      Pick<Document, 'gl' | 'renderer' | 'assets'> &
        Pick<Schema.SerializedDocument, 'resolution' | 'frameRate'>
    >,
  ) {
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

    this.#resolution = ref(options.resolution ?? DEFAULT_RESOLUTION)
    this.#frameRate = ref(options.frameRate ?? DEFAULT_FRAMERATE)

    this.timeline = new Timeline(this)

    this.whenRendererIsReady = this.#createdOwnRenderer ? this.#initPixi() : Promise.resolve()

    if (options.assets) this.assets = options.assets
    else {
      this.assets = new Map<string, AnyAsset>()
      createInitialAssets(this)
    }
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

  toObject(): Schema.DocumentSettings {
    return {
      resolution: this.resolution,
      frameRate: this.frameRate,
    }
  }

  dispose(): void {
    if (this.#createdOwnRenderer) this.renderer.destroy()
    this.#disposeAbort.abort()
  }
}
