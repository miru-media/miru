import { computed, createEffectScope, onScopeDispose, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'

import { NodeView } from '../node-view.ts'

import { MiruFilter } from './pixi-miru-filter.ts'
import type { RenderClip } from './render-clip.ts'
import type { RenderDocument } from './render-document.ts'
import type { RenderImageClip } from './render-image-clip.ts'
import type { RenderTextClip } from './render-text-clip.ts'
import type { RenderVideoClip } from './render-video-clip.ts'

type AnyVideoParentNode = Extract<pub.AnyParentNode, pub.AnyVideoNode>
export type AnyRenderClip = RenderVideoClip | RenderImageClip | RenderTextClip

export namespace RenderNodeView {
  export type AnyParentNode = AnyVideoParentNode
  export type AnyClip = AnyRenderClip
}

const getPrevRenderNode = <T extends pub.AnyVideoNode>(renderNode: RenderNodeView<T>) => {
  for (let other = renderNode.original.prev; other; other = other.prev)
    if (other.isVideo()) return renderNode.docView._getNode(other)
}

const getNextRenderNode = <T extends pub.AnyVideoNode>(renderNode: RenderNodeView<T>) => {
  for (let other = renderNode.original.next; other; other = other.next)
    if (other.isVideo()) return renderNode.docView._getNode(other)
}

export abstract class RenderNodeView<T extends pub.AnyVideoNode> extends NodeView<RenderDocument, T> {
  readonly _scope = createEffectScope()
  readonly _placeholderIsLoading = ref(false)

  abstract readonly pixiNode: Pixi.Container
  readonly pixiFilters = ref<MiruFilter[][]>([])

  readonly _visualIndex = computed((): number => (getPrevRenderNode(this)?.visualIndex ?? -1) + 1)

  constructor(renderView: RenderDocument, original: T) {
    super(renderView, original)
    this._init()

    const nestedFilters = (this.pixiFilters.value = original.effects.map((e) => this.#createFilter(e)))
    ;(this as { pixiNode: Pixi.Container }).pixiNode.filters = nestedFilters.flat()

    const abort = new AbortController()
    const listenerOptions = { signal: abort.signal }
    this.docView.doc.on('node:list-change', this.#onNestedNodeUpdate.bind(this), listenerOptions)

    this._scope.run(() => onScopeDispose(() => abort.abort()))
  }

  abstract _init(): void

  #createFilter(effect: pub.EffectListItem): MiruFilter[] {
    const filterAsset = this.original.doc.assets.getAsset(effect.assetId)
    const opFilters =
      filterAsset?.type === 'asset:effect:video'
        ? filterAsset.ops.map((op) => {
            const filter = new MiruFilter(op, effect.intensity)
            filter.sprites.forEach((sprite) => void this.docView.stage.addChild(sprite))
            return filter
          })
        : []

    return opFilters
  }

  get visualIndex(): number {
    return this._visualIndex.value
  }

  get isReady(): boolean {
    return (
      !this._placeholderIsLoading.value && !this.pixiFilters.value.some((fs) => fs.some((f) => f.isLoading))
    )
  }

  #onNestedNodeUpdate(event: pub.NodeListChangeEvent): void {
    if (event.node.id !== this.original.id) return
    if (event.path[0] !== 'effects') return

    const { action } = event
    const { type, index } = action
    const { original } = this
    const { effects } = original

    const pixiFilters = this.pixiFilters.value

    switch (type) {
      case 'insert': {
        const changed = effects[index]
        const opFilters = this.#createFilter(changed)

        this.pixiNode.filters = (this.pixiFilters.value = [
          ...pixiFilters.slice(0, index),
          opFilters,
          ...pixiFilters.slice(index),
        ]).flat()

        break
      }
      case 'update': {
        const changed = effects[index]
        const { key } = action
        if (key === 'intensity') pixiFilters[index].forEach((f) => void (f[key] = changed[key]))
        break
      }
      case 'delete': {
        pixiFilters[index].forEach((f) => f.destroy())
        this.pixiNode.filters = (this.pixiFilters.value = [
          ...pixiFilters.slice(0, index),
          ...pixiFilters.slice(index + 1),
        ]).flat()
        break
      }
    }

    this.onRendererUpdate()
  }

  onRendererUpdate(): void {
    // noop
  }

  isClip(): this is RenderClip<pub.AnyVideoClip> {
    return false
  }

  _update<Key extends keyof T>(key: Key, _oldValue: T[Key]): void {
    if (key === 'enabled') {
      const { original } = this
      this.pixiNode.visible =
        original.enabled && this.isReady && (!original.isClip() || original.isInPresentationTime)
    }
  }

  _updateSpatialVisualField<Key extends keyof T>(this: AnyRenderClip, key: Key): boolean {
    const field = this.original._fieldsByKey()[key]

    if (!field) return false

    if (field.flags & NODE_FIELD_FLAGS.TransformProp) {
      this.updateTransform()
      return true
    }
    if (key === 'opacity') this.updateOpacity()
    return false
  }

  /** @internal */
  _move(parent: RenderNodeView<AnyVideoParentNode> | undefined): void {
    const { pixiNode } = this

    if (parent) parent.pixiNode.addChildAt(pixiNode, this.visualIndex)
    else this.pixiNode.removeFromParent()
  }

  dispose(): void {
    super.dispose()
    this.pixiNode.destroy()
    this.pixiNode.removeAllListeners()
  }
}

export class RenderTimeline extends RenderNodeView<pub.Timeline> {
  pixiNode = new Pixi.Container()

  _init(): void {
    this.pixiNode = new Pixi.Container()
  }
}

export class RenderTrack extends RenderNodeView<pub.VideoTrack> {
  pixiNode!: Pixi.Container
  get visualIndex(): number {
    const { parent } = this.original
    // tracks are rendered in reverse order
    return parent ? parent.children.length - super.visualIndex - 1 : 0
  }

  /** @internal */
  _move(parent: RenderNodeView<AnyVideoParentNode> | undefined): void {
    const { pixiNode } = this

    if (!parent) {
      pixiNode.removeFromParent()
      return
    }

    const parentPixiNode = parent.pixiNode
    const nextPixiNode = getNextRenderNode(this)?.pixiNode
    // tracks are rendered in reverse order - insert after the Pixi node of the next track
    const newIndex =
      nextPixiNode?.parent === parentPixiNode ? parentPixiNode.getChildIndex(nextPixiNode) + 1 : 0

    parentPixiNode.addChildAt(pixiNode, newIndex)
  }

  _init(): void {
    this.pixiNode = new Pixi.Container()
  }

  onRendererUpdate(): void {
    // stub
  }
}
