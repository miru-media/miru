import { computed, ref, toRef } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type { Size } from 'shared/types.ts'

import type * as pub from '../../../types/core'
import { getClipTransformMatrix } from '../../utils.ts'
import { NodeView } from '../node-view.ts'

import { MiruFilter } from './pixi-miru-filter.ts'
import type { RenderDocument } from './render-document.ts'

type AnyVideoParentNode = Extract<pub.AnyParentNode, pub.AnyVideoNode>
export type AnyRenderClip = RenderVideoClip | RenderTextClip

abstract class RenderNodeView<T extends pub.AnyVideoNode> extends NodeView<RenderDocument, T> {
  abstract readonly pixiNode: Pixi.Container | Pixi.Text

  get prevVideo(): pub.AnyVideoNode | undefined {
    for (let other = this.original.prev; other; other = other.prev) if (other.isVideo()) return other
  }
  get nextVideo(): pub.AnyVideoNode | undefined {
    for (let other = this.original.next; other; other = other.next) if (other.isVideo()) return other
  }

  _visualIndex = computed(() => {
    const prevRenderNode = this.docView._getNode(this.prevVideo)
    return prevRenderNode ? prevRenderNode.visualIndex : 0
  })

  get visualIndex(): number {
    return this._visualIndex.value
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isMediaView(): this is RenderVideoClip {
    return false
  }
  isTextView(): this is RenderTextClip {
    return false
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  _update<Key extends keyof T>(key: Key, _oldValue: T[Key]): void {
    if (key === 'enabled') this.pixiNode.visible = this.original.enabled
  }

  /** @internal */
  _move(parent: RenderNodeView<AnyVideoParentNode> | undefined, originalIndex?: number): void {
    if (!parent) {
        this.pixiNode.removeFromParent()
        return
    }

    const index = parent.original.isTimeline()
      ? Math.min(Math.max(0, originalIndex ?? 0), parent.pixiNode.children.length)
      : this._visualIndex.value

    parent.pixiNode.addChildAt(this.pixiNode, index)
  }

  dispose(): void {
    super.dispose()
    this.pixiNode.destroy()
    this.pixiNode.removeAllListeners()
  }
}

export class RenderTimeline extends RenderNodeView<pub.Timeline> {
  readonly pixiNode = new Pixi.Container()
}

export class RenderTrack extends RenderNodeView<pub.Track> {
  readonly pixiNode = new Pixi.Container()
}

export class RenderVideoClip extends RenderNodeView<pub.VideoClip> {
  readonly pixiNode = new Pixi.Sprite({
    visible: false,
    texture: new Pixi.Texture(new Pixi.ImageSource({})),
  })
  readonly sprite = this.pixiNode
  readonly pixiFilters = ref<MiruFilter[]>([])

  readonly isReady = computed(() => !this.pixiFilters.value.some((f) => f.isLoading))
  matrix = computed(() => getClipTransformMatrix(this, this.docView.applyVideoRotation))

  constructor(renderView: RenderDocument, original: pub.VideoClip) {
    super(renderView, original)

    const { source } = this.sprite.texture
    source.on('destroy', () => (source.resource as Partial<VideoFrame> | undefined)?.close?.())

    this._update('mediaRef', undefined)
    this._update('effects', [])
  }

  getSize(): Size | undefined {
    const { asset } = this.original
    return asset?.video
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isMediaView(): this is RenderVideoClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  /** @internal */
  _update<Key extends keyof pub.VideoClip>(key: Key, oldValue: pub.VideoClip[Key]): void {
    super._update(key, oldValue)

    switch (key) {
      case 'translate':
      case 'rotate':
      case 'scale':
      case 'mediaRef':
        this.pixiNode.setFromMatrix(this.matrix.value)
        break
      case 'effects':
        {
          const { original } = this

          const oldEffects = oldValue as pub.VideoClip['effects']
          const newEffects = original.effects

          if (
            newEffects.length === oldEffects.length &&
            oldEffects.every((old, i) => old.assetId === newEffects[i]?.assetId)
          )
            return

          const oldFilters = this.pixiFilters.value
          oldFilters.forEach((filter) => filter.destroy())
          oldFilters.length = 0

          const pixiFilters: MiruFilter[] = (this.pixiFilters.value = [])

          newEffects.forEach((newFilter, index) => {
            const filterAsset = original.doc.assets.getAsset<pub.VideoEffectAsset>(newFilter.assetId)
            const intensityRef = toRef(() => original.effects[index]?.intensity ?? 0)

            if (typeof filterAsset === 'undefined') return

            filterAsset.ops.forEach((op) => {
              const filter = new MiruFilter(op, intensityRef)

              filter.sprites.forEach((sprite) => void this.docView.stage.addChild(sprite))
              pixiFilters.push(filter)
            })
          })

          // must be assigned after the array is filled
          this.sprite.filters = pixiFilters
        }
        break
      default:
    }
  }

  dispose(): void {
    const { texture } = this.sprite
    super.dispose()
    texture.destroy(true)

    const { pixiFilters } = this
    pixiFilters.value.forEach((f) => f.destroy())
    pixiFilters.value.length = 0
  }
}

export class RenderTextClip extends RenderNodeView<pub.TextClip> {
  readonly pixiNode = new Pixi.Text({
    text: this.original.content,
    style: this.#getPixiTextStyle(),
  })
  readonly pixiFilters = ref<MiruFilter[]>([])
  readonly isReady = ref(true)
  matrix = computed(() => getClipTransformMatrix(this, false))

  constructor(renderView: RenderDocument, original: pub.TextClip) {
    super(renderView, original)
    this.pixiNode.setFromMatrix(this.matrix.value)
  }

  getSize(): Size {
    return {
      width: this.original.inlineSize,
      height: Pixi.CanvasTextMetrics.measureText(this.original.content, this.pixiNode.style).height,
    }
  }

  #getPixiTextStyle(): Pixi.TextStyleOptions {
    const { original } = this
    return {
      fontFamily: original.fontFamily,
      fontSize: original.fontSize,
      fontWeight: original.fontWeight.toString() as any,
      fontStyle: original.fontStyle,
      align: original.align,
      wordWrapWidth: original.inlineSize,
      fill: original.fill,
      stroke: original.stroke,
      wordWrap: true,
    }
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isTextView(): this is RenderTextClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  _update<Key extends keyof pub.TextClip>(key: Key): void {
    switch (key) {
      case 'translate':
      case 'rotate':
      case 'scale':
        this.pixiNode.setFromMatrix(this.matrix.value)
        break
      case 'content':
        this.pixiNode.text = this.original.content
        break
      case 'fontFamily':
      case 'fontSize':
      case 'fontWeight':
      case 'fontStyle':
      case 'align':
      case 'inlineSize':
      case 'fill':
      case 'stroke': {
        const key_: 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'align' | 'inlineSize' | 'fill' | 'stroke' = key
        const value = this.original[key_] as any
        const { style } = this.pixiNode

        if (key_ === 'inlineSize') style.wordWrapWidth = value
        else if (key_ === 'align') style.align = value
        else style[key_] = value
        break
      }
      default:
    }
  }
}
