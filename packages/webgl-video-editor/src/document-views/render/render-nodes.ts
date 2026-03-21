import { computed, ref, toRef } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type * as pub from '../../../types/core'
import { getClipTransformMatrix } from '../../utils.ts'
import { NodeView } from '../node-view.ts'

import { MiruFilter } from './pixi-miru-filter.ts'
import type { RenderDocument } from './render-document.ts'

abstract class RenderNodeView<T extends pub.AnyVideoNode> extends NodeView<RenderDocument, T> {
  abstract readonly container: Pixi.Container

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

  _update<Key extends keyof T>(key: Key, _oldValue: T[Key]): void {
    if (key === 'enabled') this.container.visible = this.original.enabled
  }

  /** @internal */
  _move(parent: RenderNodeView<pub.AnyVideoNode> | undefined): void {
    if (parent) parent.container.addChildAt(this.container, this._visualIndex.value)
    else this.container.removeFromParent()
  }

  dispose(): void {
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

export class RenderVideoClip extends RenderNodeView<pub.VideoClip> {
  readonly container = new Pixi.Sprite({
    visible: false,
    texture: new Pixi.Texture(new Pixi.ImageSource({})),
  })
  readonly sprite = this.container
  readonly spriteFilters = ref<MiruFilter[]>([])

  readonly isReady = computed(() => !this.spriteFilters.value.some((f) => f.isLoading))
  matrix = computed(() => getClipTransformMatrix(this.original, this.docView.applyVideoRotation))

  constructor(renderView: RenderDocument, original: pub.VideoClip) {
    super(renderView, original)

    const { source } = this.sprite.texture
    source.on('destroy', () => (source.resource as Partial<VideoFrame> | undefined)?.close?.())

    this._update('mediaRef', undefined)
    this._update('effects', [])
  }

  /** @internal */
  _update<Key extends keyof pub.VideoClip>(key: Key, oldValue: pub.VideoClip[Key]): void {
    switch (key) {
      case 'translate':
      case 'rotate':
      case 'scale':
      case 'mediaRef':
        this.sprite.setFromMatrix(getClipTransformMatrix(this.original, this.docView.applyVideoRotation))
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

          const oldFilters = this.spriteFilters.value
          oldFilters.forEach((filter) => filter.destroy())
          oldFilters.length = 0

          const spriteFilters: MiruFilter[] = (this.spriteFilters.value = [])

          newEffects.forEach((newFilter, index) => {
            const filterAsset = original.doc.assets.getAsset<pub.VideoEffectAsset>(newFilter.assetId)
            const intensityRef = toRef(() => original.effects[index]?.intensity ?? 0)

            if (typeof filterAsset === 'undefined') return

            filterAsset.ops.forEach((op) => {
              const filter = new MiruFilter(op, intensityRef)

              filter.sprites.forEach((sprite) => void this.docView.stage.addChild(sprite))
              spriteFilters.push(filter)
            })
          })

          // must be assigned after the array is filled
          this.sprite.filters = spriteFilters
        }
        break
      default:
    }
  }

  dispose(): void {
    const { texture } = this.sprite
    super.dispose()
    texture.destroy(true)

    const { spriteFilters } = this
    spriteFilters.value.forEach((f) => f.destroy())
    spriteFilters.value.length = 0
  }
}
