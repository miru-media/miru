import { computed, createEffectScope, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type { Size } from 'shared/types'
import { useChangeCounter } from 'shared/utils'

import { getClipTransformMatrix } from '../../utils.ts'
import { usePlaceholderImage } from '../utils.ts'

import type { RenderDocument } from './render-document.ts'
import { RenderNodeView } from './render-nodes.ts'

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

      watch([() => this.isReady], ([ready], _prev, onCleanup) => {
        if (!ready) {
          this.docView.loadingClips.value += 1
          onCleanup(() => (this.docView.loadingClips.value -= 1))
        }
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

  isClip(): this is RenderClip<pub.AnyVideoClip> {
    return true
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
