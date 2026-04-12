import * as Pixi from 'pixi.js'

import type { AnyRenderClip } from './document-views/render/render-nodes.ts'

export const getClipTransformMatrix = (
  renderClip: AnyRenderClip,
  withVideoRotation: boolean,
): Pixi.Matrix => {
  const size = renderClip.getSize()
  if (!size) return new Pixi.Matrix()

  const clip = renderClip.original
  const { scale } = clip
  const mediaRotation = clip.isMediaClip() ? (clip.asset?.video?.rotation ?? 0) : 0

  const { width, height } = size
  const { resolution } = clip.doc

  const matrix = new Pixi.Matrix()

  if (withVideoRotation && mediaRotation !== 0) {
    const rads = (mediaRotation * Math.PI) / 180
    matrix.rotate(rads)

    matrix.translate(
      mediaRotation === 180 || mediaRotation === 90 ? width : 0,
      mediaRotation === 180 || mediaRotation === 270 ? height : 0,
    )
  }

  const { translate } = clip
  const halfWidth = width / 2
  const halfHeight = height / 2

  if (clip.rotate !== 0 || scale.x !== 1 || scale.y !== 1) {
    matrix
      .translate(-halfWidth, -halfHeight)
      .scale(scale.x, scale.y)
      .rotate((clip.rotate * Math.PI) / 180)
      .translate(halfWidth, halfHeight)
  }

  {
    // center the image
    const dx = resolution.width - width
    const dy = resolution.height - height
    if (dx !== 0 || dy !== 0) matrix.translate(dx / 2, dy / 2)
  }

  if (translate.x !== 0 || translate.y !== 0) matrix.translate(translate.x, translate.y)

  return matrix
}
