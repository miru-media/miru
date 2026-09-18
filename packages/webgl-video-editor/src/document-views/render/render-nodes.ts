import { computed, createEffectScope, type Ref, ref, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type { Size } from 'shared/types.ts'

import type * as pub from '../../../types/core'
import { NodeView } from '../node-view.ts'
import { usePlaceholderImage } from '../utils.ts'

import type { RenderDocument } from './render-document.ts'
import type { RenderImageClip } from './render-image-clip.ts'
import type { RenderTextClip } from './render-text-clip.ts'
import type { RenderVideoClip } from './render-video-clip.ts'

type AnyVideoParentNode = Extract<pub.AnyParentNode, pub.AnyVideoNode>
export type AnyRenderClip = RenderVideoClip | RenderImageClip | RenderTextClip

interface SpatialVisualNode {
  readonly original: Extract<pub.AnyVideoNode, pub.Schema.TransformProps>
  readonly matrix: Ref<Pixi.Matrix>
  getSize: () => Size | undefined
  updateTransform: () => void
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

  abstract readonly _reactiveRenderProps: Ref | undefined
  abstract readonly pixiNode: Pixi.Container | Pixi.Text

  readonly _visualIndex = computed((): number => (getPrevRenderNode(this)?.visualIndex ?? -1) + 1)

  get visualIndex(): number {
    return this._visualIndex.value
  }

  get isReady(): boolean {
    return !this._placeholderIsLoading.value
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isMediaView(): this is RenderVideoClip {
    return false
  }
  isTextView(): this is RenderTextClip {
    return false
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  getSize(this: RenderNodeView<pub.AnyVideoNode> & SpatialVisualNode): Size | undefined {
    const { asset } = this.original
    if (!asset) return this.docView.doc.resolution

    switch (asset.type) {
      case 'asset:media:image':
        return asset
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
    if (key === 'enabled') {
      const { original } = this
      this.pixiNode.visible =
        original.enabled && this.isReady && (!original.isClip() || original.isInPresentationTime)
    }
  }

  _updateSpatialVisualField<Key extends keyof T>(this: SpatialVisualNode, key: Key): boolean {
    switch (key) {
      case 'translateX':
      case 'translateY':
      case 'rotate':
      case 'scaleX':
      case 'scaleY':
        this.updateTransform()
        return true
      default:
        return false
    }
  }

  _initSpatialVisual(this: this & SpatialVisualNode): void {
    this._update('effects', [])
    this.updateTransform()

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
  readonly _reactiveRenderProps = undefined
  readonly pixiNode = new Pixi.Container()
}

export class RenderTrack extends RenderNodeView<pub.VideoTrack> {
  readonly _reactiveRenderProps = undefined
  readonly pixiNode = new Pixi.Container()
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
}
