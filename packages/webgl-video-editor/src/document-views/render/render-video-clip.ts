import * as Pixi from 'pixi.js'

import type * as pub from '#core'

import { getClipTransformMatrix } from '../../utils.ts'

import type { RenderDocument } from './render-document.ts'
import { RenderClip } from './render-nodes.ts'

export class RenderVideoClip extends RenderClip<pub.VideoClip> {
  pixiNode!: Pixi.Sprite

  constructor(renderView: RenderDocument, original: pub.VideoClip) {
    super(renderView, original)

    const sprite = this.pixiNode
    const { source } = sprite.texture
    sprite.texture.source.on('destroy', () => (source.resource as Partial<VideoFrame> | undefined)?.close?.())

    this._update('mediaRef', undefined)
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
  _update<Key extends keyof pub.VideoClip>(key: Key, oldValue: pub.VideoClip[Key]): void {
    super._update(key, oldValue)

    if (this._updateSpatialVisualField(key)) return undefined
  }

  dispose(): void {
    const { texture } = this.pixiNode
    super.dispose()
    texture.destroy(true)

    this._scope.stop()
  }
}
