import { computed, ref, toRef } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type * as pub from '#core'

import { getClipTransformMatrix } from '../../utils.ts'

import { MiruFilter } from './pixi-miru-filter.ts'
import type { RenderDocument } from './render-document.ts'
import { RenderClip, spatialOnRenderUpdate } from './render-nodes.ts'

export class RenderVideoClip extends RenderClip<pub.VideoClip, Pixi.Sprite> {
  readonly _reactiveRenderProps = computed(() => ({
    pixiFilters: this.pixiFilters,
    matrix: this.matrix.value,
    opacity: this.original.opacity,
  }))

  readonly pixiFilters = ref<MiruFilter[]>([])

  readonly #isReady = computed(() => !this.pixiFilters.value.some((f) => f.isLoading))
  get isReady(): boolean {
    return super.isReady && this.#isReady.value
  }

  constructor(renderView: RenderDocument, original: pub.VideoClip) {
    const sprite = new Pixi.Sprite({
      visible: false,
      texture: new Pixi.Texture(new Pixi.ImageSource({})),
    })
    super(renderView, original, sprite)

    const { source } = sprite.texture
    sprite.texture.source.on('destroy', () => (source.resource as Partial<VideoFrame> | undefined)?.close?.())

    this._update('mediaRef', undefined)
    this.updateVisual()
  }

  onRendererUpdate(): void {
    super.onRendererUpdate()
    spatialOnRenderUpdate(this)
  }

  updateTransform(): void {
    this.pixiNode.setFromMatrix(getClipTransformMatrix(this, this.docView.applyVideoRotation))
  }

  /** @internal */
  _update<Key extends keyof pub.VideoClip>(key: Key, oldValue: pub.VideoClip[Key]): void {
    super._update(key, oldValue)

    if (this._updateSpatialVisualField(key)) return

    switch (key) {
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
          this.pixiNode.filters = pixiFilters
        }
        break
      default:
    }
  }

  dispose(): void {
    const { texture } = this.pixiNode
    super.dispose()
    texture.destroy(true)

    this._scope.stop()

    const { pixiFilters } = this
    pixiFilters.value.forEach((f) => f.destroy())
    pixiFilters.value.length = 0
  }
}
