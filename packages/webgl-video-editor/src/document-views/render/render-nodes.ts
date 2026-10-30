import { computed, createEffectScope, ref, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type { Size } from 'shared/types.ts'
import { useChangeCounter } from 'shared/utils/index.ts'

import { getClipTransformMatrix } from '../../utils.ts'
import { NodeView } from '../node-view.ts'
import { usePlaceholderImage } from '../utils.ts'

import { MiruFilter } from './pixi-miru-filter.ts'
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

    this.original.effects.forEach((effect) => void this.#createFilter(effect, false))

    this.docView.doc.on('node:list-change', (event) => {
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
          this.#createFilter(changed, false)

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
          pixiFilters.splice(index, 1)
          this.pixiNode.filters = (this.pixiFilters.value = [
            ...pixiFilters.slice(0, index),
            ...pixiFilters.slice(index + 1),
          ]).flat()
          break
        }
      }
    })
  }

  abstract _init(): void

  #createFilter(effect: pub.EffectListItem, initial: boolean): MiruFilter[] {
    const pixiFilters = this.pixiFilters.value
    const filterAsset = this.original.doc.assets.getAsset<pub.VideoEffectAsset>(effect.assetId)
    const opFilters =
      typeof filterAsset === 'undefined'
        ? []
        : filterAsset.ops.map((op) => {
            const filter = new MiruFilter(op, effect.intensity)
            filter.sprites.forEach((sprite) => void this.docView.stage.addChild(sprite))
            return filter
          })

    if (!initial) {
      const { index } = effect
      this.pixiNode.filters = (this.pixiFilters.value = [
        ...pixiFilters.slice(0, index),
        opFilters,
        ...pixiFilters.slice(index),
      ]).flat()
    }

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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- stub
  onRendererUpdate(): void {
    // noop
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

  _init() {
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

  _init() {
    this.pixiNode = new Pixi.Container()
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- stub
  onRendererUpdate(): void {
    // stub
  }
}

export abstract class RenderClip<T extends pub.AnyVideoClip> extends RenderNodeView<T> {
  readonly transformUpdated = useChangeCounter()
  readonly matrix = computed(() => {
    this.transformUpdated.track()
    return getClipTransformMatrix(this, false)
  })

  constructor(renderView: RenderDocument, original: T) {
    super(renderView, original)

    this._scope.run(() => {
      const { original } = this

      watch([() => original.asset], ([asset], _prev, onCleanup) => {
        if (!(this.pixiNode instanceof Pixi.Sprite)) return

        const { texture } = this.pixiNode
        if (asset) return

        const scope = createEffectScope()
        onCleanup(scope.stop.bind(scope))
        this._placeholderIsLoading.value = true

        texture.source.resource = scope.run(() =>
          usePlaceholderImage({
            text: () => original.name,
            color: () => original.color,
            size: () => original.doc.resolution,
            onLoad: () => {
              if (this.isDisposed) return
              texture.source.update()
              this._placeholderIsLoading.value = false
            },
          }),
        )
        texture.update()
      })
    })

    this.transformUpdated.inc()
    this.updateOpacity()
  }

  onRendererUpdate(): void {
    const { original } = this
    const { animationMap } = original

    if (!this.transformUpdated.isDirty()) {
      for (const animation of animationMap.values()) {
        if (animation.flags & NODE_FIELD_FLAGS.TransformProp && animation.canInterpolate()) {
          this.transformUpdated.inc()
          break
        }
      }
    }

    if (this.transformUpdated.isDirty()) this.updateTransform()

    if (animationMap.get('opacity')) this.updateOpacity()
  }

  updateTransform(): void {
    this.pixiNode.setFromMatrix(this.matrix.value)
    this.transformUpdated.markClean()

    this.docView.needsRender.value = true
  }

  updateOpacity(): void {
    this.pixiNode.alpha = this.original.opacity
  }

  getSize(): Size | undefined {
    const { asset } = this.original
    if (!asset) return this.docView.doc.resolution

    switch (asset.type) {
      case 'asset:media:image':
      case 'asset:media:av': {
        if (!asset.video) return

        const { width, height, rotation } = asset.video
        return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height }
      }
      case 'asset:font':
      case 'asset:effect:video':
        return undefined
    }
  }

  _update<Key extends keyof T>(key: Key, _oldValue: T[Key]): void {
    super._update(key, _oldValue)
    if (key === 'opacity') this.pixiNode.alpha = this.original.opacity
  }

  dispose() {
    super.dispose()
    this.pixiFilters.value.forEach((fs) => fs.forEach((f) => f.destroy()))
    this.pixiFilters.value.length = 0
    this.pixiNode.filters = undefined
  }
}
