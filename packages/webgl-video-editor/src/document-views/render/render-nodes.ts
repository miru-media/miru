import { computed, toRef } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type * as pub from '../../../types/core'
import { getClipTransformMatrix } from '../../utils.ts'
import { NodeView } from '../node-view.ts'

import { MiruFilter } from './pixi-miru-filter.ts'
import type { RenderDocument } from './render-document.ts'

const updateSpriteTransform = (view: RenderVisualClip, withVideoRotation: boolean): void => {
  view.sprite.setFromMatrix(getClipTransformMatrix(view.original, withVideoRotation))
}

abstract class RenderNodeView<T extends pub.AnyVisualNode> extends NodeView<RenderDocument, T> {
  abstract readonly container: Pixi.Container

  get prevVisual(): pub.AnyVisualNode | undefined {
    for (let other = this.original.prev; other; other = other.prev) if (other.isVisual()) return other
  }
  get nextVisual(): pub.AnyVisualNode | undefined {
    for (let other = this.original.next; other; other = other.next) if (other.isVisual()) return other
  }

  _visualIndex = computed(() => {
    const prevRenderNode = this.docView._getNode(this.prevVisual)
    return prevRenderNode ? prevRenderNode.visualIndex : 0
  })

  get visualIndex(): number {
    return this._visualIndex.value
  }

  /** @internal */
  _move(parent: RenderNodeView<pub.AnyVisualNode> | undefined): void {
    if (parent) parent.container.addChildAt(this.container, this._visualIndex.value)
    else this.container.removeFromParent()
  }

  dispose() {
    super.dispose()
    this.container.destroy()
    this.container.removeAllListeners()
  }
}

export class RenderTimeline extends RenderNodeView<pub.Timeline> {
  readonly container = new Pixi.Container()
}

export class RenderTrack extends RenderNodeView<pub.Track> {
  readonly container = new Pixi.Container()
}

export class RenderVisualClip extends RenderNodeView<pub.VisualClip> {
  readonly container = new Pixi.Sprite({
    visible: false,
    texture: new Pixi.Texture(new Pixi.ImageSource({})),
  })
  readonly sprite = this.container
  _pixiFilters: MiruFilter[] = []

  constructor(renderView: RenderDocument, original: pub.VisualClip) {
    super(renderView, original)

    const { source } = this.sprite.texture
    source.on('destroy', () => (source.resource as Partial<VideoFrame> | undefined)?.close?.())

    this._update('sourceRef', undefined as never)
    this._update('filter', undefined)
  }

  /** @internal */
  _update<Key extends keyof pub.VisualClip>(key: Key, oldValue: pub.VisualClip[Key]): void {
    switch (key) {
      case 'position':
      case 'rotation':
      case 'scale':
      case 'sourceRef':
        updateSpriteTransform(this, this.docView.applyVideoRotation)
        break
      case 'filter':
        {
          const { original } = this
          const newFilter = original.filter

          if ((oldValue as pub.VisualClip['filter'])?.assetId === newFilter?.assetId) return

          this._pixiFilters.forEach((filter) => filter.destroy())
          this._pixiFilters.length = 0
          const filterAsset =
            newFilter && original.doc.assets.getAsset<pub.VideoEffectAsset>(newFilter.assetId)

          const intensityRef = toRef(() => original.filter?.intensity ?? 0)
          this.sprite.filters = this._pixiFilters =
            filterAsset?.ops.map((op) => new MiruFilter(op, intensityRef)) ?? []

          this._pixiFilters.forEach((filter) =>
            filter.sprites.forEach((sprite) => void this.docView.stage.addChild(sprite)),
          )
        }
        break
      default:
    }
  }

  dispose() {
    const { texture } = this.sprite
    super.dispose()
    texture.destroy(true)
  }
}
