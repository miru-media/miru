import { ref, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type * as pub from '#core'
import { loadAsyncImageSource } from 'shared/utils'

import { getClipTransformMatrix } from '../../utils.ts'

import type { RenderDocument } from './render-document.ts'
import { RenderClip } from './render-nodes.ts'

export class RenderImageClip extends RenderClip<pub.ImageClip> {
  pixiNode!: Pixi.Sprite
  get isReady(): boolean {
    return super.isReady && !!this.img.value
  }

  img = ref<ImageBitmap>()

  constructor(renderView: RenderDocument, original: pub.ImageClip) {
    super(renderView, original)

    const { source } = this.pixiNode.texture
    source.on('destroy', () => (source.resource as Partial<ImageBitmap> | undefined)?.close?.())

    this._update('mediaRef', undefined)

    watch(
      [() => original.asset?.blob, () => original.asset?.isLoading === true],
      async ([source, loading], _prev, onCleanup) => {
        if (loading) return

        let isStale = false as boolean
        onCleanup(() => (isStale = true))
        const { texture } = this.pixiNode

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

  _init(): void {
    this.pixiNode = new Pixi.Sprite({
      visible: false,
      texture: new Pixi.Texture(new Pixi.ImageSource({})),
    })
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
