import { computed, ref, type Ref } from 'fine-jsx'

import { FileSystemAssetStore } from '#assets'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION } from '#constants'
import type * as pub from '#core'
import type { Schema } from '#core'
import { AudioClip, AudioTrack, VideoClip, VideoTrack } from '#nodes'
import type { Size } from 'shared/types.ts'
import { clamp, Rational } from 'shared/utils/math.ts'

import {
  DocDisposeEvent,
  LinkCreateEvent,
  LinkDeleteEvent,
  LinkUpdateEvent,
  PlaybackSeekEvent,
  SettingsUpdateEvent,
} from './events.ts'
import { TextClip } from './nodes/clips/text-clip.ts'
import { Timeline } from './nodes/timeline.ts'

const SEEK_EVENT = new PlaybackSeekEvent()

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
  readonly #links = ref(new Map<string, Schema.NodeLink>())
  get links(): Map<string, Schema.NodeLink> {
    return this.#links.value
  }

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
      for (let clip = track.head; clip; clip = clip.next) if (!clip.isReady && clip.isInClipTime) return true
    return false
  })

  get duration(): number {
    return this.#duration.value
  }

  get currentTime(): number {
    return this._currentTime.value
  }

  readonly timeline: Timeline

  _isEmpty = computed(() => this.timeline.children.every((track) => !track.head))
  get isEmpty(): boolean {
    return this._isEmpty.value
  }

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
      case 'track:video':
        node = new VideoTrack(this, init)
        break
      case 'track:audio':
        node = new AudioTrack(this, init)
        break
      case 'clip:video':
        node = new VideoClip(this, init)
        break
      case 'clip:audio':
        node = new AudioClip(this, init)
        break
      case 'clip:text':
        node = new TextClip(this, init)
        break
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- in case of invalid input
      default:
        throw new Error(`[webgl-video-editor] Unexpected init of type "${(init as { type: string }).type}".`)
    }

    return node as pub.NodesByType[T['type']]
  }

  #setNodeLinkProps(link: Schema.NodeLink, clear = false): void {
    const newLink = clear ? undefined : link
    link.nodes.forEach((n) => {
      this.nodes.get<VideoTrack | AudioTrack | VideoClip /* | etc. */>(n.id)._link.value = newLink
    })
  }

  createLink(init: Schema.NodeLink) {
    const link = { id: init.id, nodes: init.nodes.map(({ id, type }) => ({ id, type })) }

    ;(this.#links.value = new Map(this.links)).set(link.id, link)
    this.#setNodeLinkProps(link)
    this.emit(new LinkCreateEvent(link))
    return link
  }

  updateLink(id: string, nodes: Schema.NodeLink['nodes']) {
    const link = this.links.get(id)!
    const from = link.nodes

    if (from.length === nodes.length && from.every((n, i) => n.id === nodes[i].id)) return

    this.#setNodeLinkProps(link, true)
    this.#links.value = new Map(this.links)
    link.nodes = nodes.map(({ id, type }) => ({ id, type }))
    this.#setNodeLinkProps(link)
    this.emit(new LinkUpdateEvent(link, from))
  }

  deleteLink(id: string) {
    const init = this.links.get(id)
    if (!init) return

    this.#setNodeLinkProps(init, true)
    ;(this.#links.value = new Map(this.links)).delete(id)
    this.emit(new LinkDeleteEvent(init))
  }

  seekTo(time: number): void {
    this._setCurrentTime(Rational.fromDecimal(time, this.frameRate).valueOf())
    this.emit(SEEK_EVENT)
  }

  _setCurrentTime(time: number): void {
    const { duration } = this
    this._currentTime.value = clamp(time, 0, duration)
  }

  on<T extends Extract<keyof pub.VideoEditorEvents, string>>(
    type: T,
    listener: (event: pub.VideoEditorEvents[T]) => void,
    options_?: AddEventListenerOptions,
  ): () => void {
    const options = { signal: this.#disposeAbort.signal, ...options_ }
    this.#eventTarget.addEventListener(type, listener, options)
    const remove = () => this.#eventTarget.removeEventListener(type, listener, options)
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

    const createChildren = (parent: pub.AnyNode, childrenInit: Schema.AnySerializedNode[]): void => {
      childrenInit.forEach((childInit, index) => {
        const childNode = this.createNode(childInit)
        childNode.move({ parentId: parent.id, index })

        if ('gap' in childInit && childInit.gap && 'gap' in childNode)
          childNode.gap = Rational.from(childInit.gap)

        if ('children' in childInit) createChildren(childNode, childInit.children)
      })
    }

    createChildren(this.timeline, content.timeline.children)

    content.links.forEach((init) => void this.createLink(init))
  }

  toJSON(): Schema.SerializedDocument {
    const serialize = <T extends Schema.AnyNode['type'], TN extends Extract<pub.AnyNode, { type: T }>>(
      node: TN,
    ): Extract<Schema.AnySerializedNode, ReturnType<TN['toJSON']>> => {
      const json = node.toJSON()
      const serialized = 'children' in node ? { ...json, children: node.children.map(serialize) } : json

      return (
        'gap' in node && node.gap.value !== 0 ? { ...serialized, gap: node.gap.toJSON() } : serialized
      ) as Extract<Schema.AnySerializedNode, ReturnType<TN['toJSON']>>
    }

    return {
      resolution: this.resolution,
      frameRate: this.frameRate,
      assets: Array.from(this.assets.values())
        .filter((asset) => !asset.isBuiltIn)
        .map((asset) => asset.toJSON()),
      timeline: serialize(this.timeline),
      links: Array.from(this.links.values()),
    }
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    this.emit(new DocDisposeEvent(this))
    this.#disposeAbort.abort()
    this.nodes.forEach((node) => node.dispose(true))

    if (this.#ownsAssetStore) this.assets.dispose()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
