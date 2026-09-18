import { computed, ref, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type * as pub from '#core'
import { loadAsyncImageSource } from 'shared/utils'

import { getClipTransformMatrix } from '../../utils.ts'

import type { MiruFilter } from './pixi-miru-filter.ts'
import type { RenderDocument } from './render-document.ts'
import { RenderNodeView } from './render-nodes.ts'

export class RenderImageClip extends RenderNodeView<pub.ImageClip> {
  readonly _reactiveRenderProps = computed(() => ({
    pixiFilters: this.pixiFilters,
    matrix: this.matrix.value,
  }))

  readonly pixiNode = new Pixi.Sprite({
    visible: false,
    texture: new Pixi.Texture(new Pixi.ImageSource({})),
  })
  readonly sprite = this.pixiNode
  readonly pixiFilters = ref<MiruFilter[]>([])

  readonly #isReady = computed(
    () =>
      !this.pixiFilters.value.some((f) => f.isLoading) &&
      !this._placeholderIsLoading.value &&
      !!this.img.value,
  )
  get isReady(): boolean {
    return super.isReady && this.#isReady.value
  }

  readonly matrix = computed((): Pixi.Matrix => getClipTransformMatrix(this, false))
  img = ref<ImageBitmap>()

  constructor(renderView: RenderDocument, original: pub.ImageClip) {
    super(renderView, original)

    const { source } = this.sprite.texture
    source.on('destroy', () => (source.resource as Partial<ImageBitmap> | undefined)?.close?.())

    this._update('mediaRef', undefined)
    this._initSpatialVisual()

    watch(
      [() => original.asset?.blob, () => original.asset?.isLoading === true],
      async ([source, loading], _prev, onCleanup) => {
        if (loading) return

        let isStale = false as boolean
        onCleanup(() => (isStale = true))
        const { texture } = this.sprite

        if (source) {
          const { promise, close } = loadAsyncImageSource(source, undefined, false)
          this.img.value = await promise
          if (isStale) {
            close()
            return
          }

          texture.source.resource = this.img.value
          texture.source.update()
          texture.update()
        } else {
          this.img.value = undefined
        }
      },
    )
  }

  updateTransform(): void {
    this.pixiNode.setFromMatrix(getClipTransformMatrix(this, this.docView.applyVideoRotation))
  }

  /** @internal */
  _update<Key extends keyof pub.ImageClip>(key: Key, oldValue: pub.ImageClip[Key]): void {
    super._update(key, oldValue)

    this._updateSpatialVisualField(key)
  }
}
