import { computed, ref, type Ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import { FileSystemAssetStore, HttpAssetLoader } from '#assets'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION } from '#constants'
import type * as pub from '#core'
import type { Schema } from '#core'
import { AudioClip, Gap, VisualClip } from '#nodes'
import type { Size } from 'shared/types.ts'
import { clamp } from 'shared/utils/math.ts'

import { LutUploaderSystem } from './document-views/render/pixi-lut-source.ts'
import { DocDisposeEvent, PlaybackSeekEvent, SettingsUpdateEvent } from './events.ts'
import { Timeline } from './nodes/timeline.ts'
import { Track } from './nodes/track.ts'

const SEEK_EVENT = new PlaybackSeekEvent()

Pixi.extensions.add(LutUploaderSystem)

class NodeMap implements pub.NodeMap {
  map: pub.NodeMap['map'] = new Map()
  byType: pub.NodeMap['byType'] = {
    timeline: new Set(),
    track: new Set(),
    clip: new Set(),
    gap: new Set(),
  }
  get<T extends pub.AnyNode>(id: T['id']): T {
    return this.map.get(id) as T
  }
  set(node: pub.AnyNode): void {
    this.map.set(node.id, node)
    const typeSet: Set<pub.NodesByType[typeof node.type]> = this.byType[node.type]
    typeSet.add(node)
  }
  has(id: string): boolean {
    return this.map.has(id)
  }
  delete(id: string): boolean {
    const node = this.map.get(id)
    if (!node) return true

    const typeSet: Set<pub.NodesByType[typeof node.type]> = this.byType[node.type]
    typeSet.delete(node)

    return this.map.delete(id)
  }
}

export class Document implements pub.Document {
  declare parent?: undefined

  nodes = new NodeMap()
  declare assets: pub.VideoEditorAssetStore
  readonly #ownsAssetStore: boolean = false

  readonly _currentTime = ref(0)
  readonly #duration = computed(() =>
    this.timeline.children.reduce((end, track) => Math.max(track.duration, end), 0),
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

  constructor(options: Partial<Pick<Document, 'assets'> & Schema.DocumentSettings>) {
    this.on('node:create', ({ node }) => this.nodes.set(node))
    this.on('node:delete', ({ node }) => this.nodes.delete(node.id))

    this.#resolution = ref(options.resolution ?? DEFAULT_RESOLUTION)
    this.#frameRate = ref(options.frameRate ?? DEFAULT_FRAMERATE)

    this.timeline = new Timeline(this)

    if (options.assets) this.assets = options.assets
    else {
      this.#ownsAssetStore = true
      this.assets = new FileSystemAssetStore()
      this.assets.loaders.push(new HttpAssetLoader())
    }
  }

  createNode<T extends Schema.AnyNodeSchema>(init: T): pub.NodesByType[T['type']] {
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
            node = new VisualClip(this, init)
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
    this._setCurrentTime(time)
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
    options?: AddEventListenerOptions,
  ): () => void {
    options = { signal: this.#disposeAbort.signal, ...options }
    this.#eventTarget.addEventListener(type, listener as any, options)
    const remove = () => this.#eventTarget.removeEventListener(type, listener as any, options)
    return remove
  }

  /** @internal @hidden */
  emit(event: pub.VideoEditorEvents[keyof pub.VideoEditorEvents]): void {
    this.#eventTarget.dispatchEvent(event)
  }

  toObject(): Schema.DocumentSettings {
    return {
      resolution: this.resolution,
      frameRate: this.frameRate,
    }
  }

  importFromJson(content: Schema.SerializedDocument): void {
    this.resolution = content.resolution
    this.frameRate = content.frameRate

    content.assets.forEach((init) => this.assets.create(init))

    const createChildren = (parent: pub.AnyNode, childrenInit: Schema.AnyNodeSerializedSchema[]): void => {
      childrenInit.forEach((childInit, index) => {
        const childNode = this.createNode(childInit)
        childNode.move({ parentId: parent.id, index })
        if ('children' in childInit) createChildren(childNode, childInit.children)
      })
    }

    createChildren(this.timeline, content.tracks)
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    this.emit(new DocDisposeEvent(this))
    this.#disposeAbort.abort()
    this.nodes.map.forEach((node) => node.dispose())

    if (this.#ownsAssetStore) this.assets.dispose()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
