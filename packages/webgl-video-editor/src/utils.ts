import * as Pixi from 'pixi.js'

import type * as pub from '../types/core.d.ts'

export const getClipTransformMatrix = (clip: pub.VisualClip, withVideoRotation: boolean): Pixi.Matrix => {
  const { scale, sourceAsset } = clip
  if (!sourceAsset) return new Pixi.Matrix()

  const { width, height, rotation: videoRotation } = sourceAsset.video!

  const matrix = new Pixi.Matrix()

  if (withVideoRotation && videoRotation !== 0) {
    const rads = (videoRotation * Math.PI) / 180
    matrix.rotate(rads)

    matrix.translate(
      videoRotation === 180 || videoRotation === 90 ? width : 0,
      videoRotation === 180 || videoRotation === 270 ? height : 0,
    )
  }

  const { position } = clip
  const halfWidth = width / 2
  const halfHeight = height / 2

  if (clip.rotation !== 0 || scale.x !== 1 || scale.y !== 1) {
    matrix
      .translate(-halfWidth, -halfHeight)
      .scale(scale.x, scale.y)
      .rotate((clip.rotation * Math.PI) / 180)
      .translate(halfWidth, halfHeight)
  }

  if (position.x !== 0 || position.y !== 0) matrix.translate(position.x, position.y)

  return matrix
}
