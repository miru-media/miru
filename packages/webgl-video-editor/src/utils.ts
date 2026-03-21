import * as Pixi from 'pixi.js'

import type * as pub from '../types/core.d.ts'

export const getClipTransformMatrix = (clip: pub.VideoClip, withVideoRotation: boolean): Pixi.Matrix => {
  const { scale, asset } = clip
  if (!asset?.video) return new Pixi.Matrix()

  const { width, height, rotation: videoRotation } = asset.video
  const { resolution } = clip.doc

  const matrix = new Pixi.Matrix()

  if (withVideoRotation && videoRotation !== 0) {
    const rads = (videoRotation * Math.PI) / 180
    matrix.rotate(rads)

    matrix.translate(
      videoRotation === 180 || videoRotation === 90 ? width : 0,
      videoRotation === 180 || videoRotation === 270 ? height : 0,
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
