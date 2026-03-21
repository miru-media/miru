import { computed, ref, type Ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import { FileSystemAssetStore } from '#assets'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION } from '#constants'
import type * as pub from '#core'
import type { Schema } from '#core'
import { AudioClip, Gap, VideoClip } from '#nodes'
import type { Size } from 'shared/types.ts'
import { clamp, Rational } from 'shared/utils/math.ts'

import { LutUploaderSystem } from './document-views/render/pixi-lut-source.ts'
import { DocDisposeEvent, PlaybackSeekEvent, SettingsUpdateEvent } from './events.ts'
import { Timeline } from './nodes/timeline.ts'
import { Track } from './nodes/track.ts'

const SEEK_EVENT = new PlaybackSeekEvent()

Pixi.extensions.add(LutUploaderSystem)

class NodeMap implements pub.NodeMap {
  private readonly map = new Map<string, pub.AnyNode>()
  forEach = this.map.forEach.bind(this.map)
  get<T extends pub.AnyNode>(id: T['id']): T {
    return this.map.get(id) as T
  }
  set(node: pub.AnyNode): void {
    this.map.set(node.id, node)
  }
  has(id: string): boolean {
    return this.map.has(id)
  }
  delete(id: string): boolean {
    const node = this.map.get(id)
    if (!node) return true

    return this.map.delete(id)
  }
}

/**
 * The video editor {@link pub.Document} is a [headless](https://en.wikipedia.org/wiki/Headless_software)
 * interface containing a mutable tree of timeline nodes, resolution, frameRate, and currentTime.
 */
export class Document implements pub.Document {
  declare parent?: undefined

  nodes = new NodeMap()
  declare assets: pub.VideoEditorAssetStore
  readonly #ownsAssetStore: boolean = false

  readonly _currentTime = ref(0)
  readonly #duration = computed(() =>
    this.timeline.children.reduce((end, track) => Math.max(track.duration.valueOf(), end), 0),
  )

  readonly #resolution: Ref<Size>
  readonly #frameRate: Ref<number>

  get resolution(): Size {
    return this.#resolution.value
  }
  set resolution(value) {
    this.#resolution.value = value
    const prev = this.resolution
    this.emit(new SettingsUpdateEvent({ resolution: prev }))
  }
  get frameRate(): number {
    return this.#frameRate.value
  }
  set frameRate(value) {
    const prev = this.frameRate
    this.#frameRate.value = value
    this.emit(new SettingsUpdateEvent({ frameRate: prev }))
  }

  readonly #eventTarget = new EventTarget()
  readonly #disposeAbort = new AbortController()

  readonly activeClipIsStalled = computed(() => {
    for (let track = this.timeline.head; track; track = track.next)
      for (let clip = track.firstClip; clip; clip = clip.nextClip)
        if (!clip.isReady && clip.isInClipTime) return true
    return false
  })

  get duration(): number {
    return this.#duration.value
  }

  get currentTime(): number {
    return this._currentTime.value
  }

  readonly timeline: Timeline
  isDisposed = false

  constructor(options: Partial<Schema.DocumentSettings & { assets: pub.VideoEditorAssetStore }>) {
    this.on('node:create', ({ node }) => this.nodes.set(node))
    this.on('node:delete', ({ node }) => void this.nodes.delete(node.id))

    this.#resolution = ref(options.resolution ?? DEFAULT_RESOLUTION)
    this.#frameRate = ref(options.frameRate ?? DEFAULT_FRAMERATE)

    if (options.assets) this.assets = options.assets
    else {
      this.#ownsAssetStore = true
      this.assets = new FileSystemAssetStore()
    }

    this.timeline = new Timeline(this)
  }

  createNode<T extends Schema.AnyNode>(init: T): pub.NodesByType[T['type']] {
    let node: pub.AnyNode

    switch (init.type) {
      case 'timeline':
        node = new Timeline(this)
        break
      case 'track':
        node = new Track(this, init)
        break
      case 'clip':
        switch (init.clipType) {
          case 'video':
            node = new VideoClip(this, init)
            break
          case 'audio':
            node = new AudioClip(this, init)
            break
        }
        break
      case 'gap':
        node = new Gap(this, init)
        break
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- in case of invalid input
      default:
        throw new Error(`[webgl-video-editor] Unexpected init of type "${(init as { type: string }).type}".`)
    }

    return node as pub.NodesByType[T['type']]
  }

  seekTo(time: number): void {
    this._setCurrentTime(Rational.fromDecimal(time, this.frameRate).valueOf())
    this.emit(SEEK_EVENT)
  }

  _setCurrentTime(time: number): void {
    const { duration } = this
    this._currentTime.value = clamp(time, 0, duration)
  }

  get isEmpty(): boolean {
    return this.timeline.children.every((track) => !track.firstClip)
  }

  on<T extends Extract<keyof pub.VideoEditorEvents, string>>(
    type: T,
    listener: (event: pub.VideoEditorEvents[T]) => void,
    options_?: AddEventListenerOptions,
  ): () => void {
    const options = { signal: this.#disposeAbort.signal, ...options_ }
    this.#eventTarget.addEventListener(type, listener as any, options)
    const remove = () => this.#eventTarget.removeEventListener(type, listener as any, options)
    return remove
  }

  /** @internal */
  emit(event: pub.VideoEditorEvents[keyof pub.VideoEditorEvents]): void {
    this.#eventTarget.dispatchEvent(event)
  }

  importFromJson(content: Schema.SerializedDocument): void {
    this.resolution = content.resolution
    this.frameRate = content.frameRate

    content.assets.forEach((init) => void this.assets.create(init))

    const createChildren = (parent: pub.AnyNode, childrenInit: Schema.AnyNodeSerializedSchema[]): void => {
      childrenInit.forEach((childInit, index) => {
        const childNode = this.createNode(childInit)
        childNode.move({ parentId: parent.id, index })
        if ('children' in childInit) createChildren(childNode, childInit.children)
      })
    }

    createChildren(this.timeline, content.tracks)
  }

  toJSON(): Schema.SerializedDocument {
    const serialize = <
      T extends (Schema.AnyNode | Schema.AnyAssetSchema)['type'],
      TN extends Extract<pub.AnyNode | pub.AnyAsset, { type: T }>,
    >(
      node: TN,
    ): Extract<Schema.AnyNodeSerializedSchema, ReturnType<TN['toJSON']>> => {
      const json = node.toJSON()
      const serialized = 'children' in node ? { ...json, children: node.children.map(serialize) } : json

      return serialized as Extract<Schema.AnyNodeSerializedSchema, ReturnType<TN['toJSON']>>
    }

    const { assets: _assets, timeline, resolution, frameRate } = this

    return {
      resolution,
      frameRate,
      assets: Array.from(_assets.values()).map(serialize),
      tracks: timeline.children.map(serialize),
    }
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    this.emit(new DocDisposeEvent(this))
    this.#disposeAbort.abort()
    this.nodes.forEach((node) => node.dispose())

    if (this.#ownsAssetStore) this.assets.dispose()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
