import { type MaybeRefOrGetter, ref, toValue } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type { Size } from 'shared/types.ts'
import { clamp, remap } from 'shared/utils/math.ts'

import type { AnyRenderClip } from './document-views/render/render-nodes.ts'

export const getClipTransformMatrix = (
  renderClip: AnyRenderClip,
  withVideoRotation: boolean,
): Pixi.Matrix => {
  const size = renderClip.getSize()
  if (!size) return new Pixi.Matrix()

  const clip = renderClip.original
  const { scaleX, scaleY } = clip
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

  const { translateX, translateY } = clip
  const halfWidth = width / 2
  const halfHeight = height / 2

  if (clip.rotate !== 0 || scaleX !== 1 || scaleY !== 1) {
    matrix
      .translate(-halfWidth, -halfHeight)
      .scale(scaleX, scaleY)
      .rotate((clip.rotate * Math.PI) / 180)
      .translate(halfWidth, halfHeight)
  }

  {
    // center the image
    const dx = resolution.width - width
    const dy = resolution.height - height
    if (dx !== 0 || dy !== 0) matrix.translate(dx / 2, dy / 2)
  }

  if (translateX !== 0 || translateY !== 0) matrix.translate(translateX, translateY)

  return matrix
}

const PPS_CHANGE_AMOUNT = 0.05
const INITIAL_SECONDS_PER_PIXEL = 0.01

export class TimelineZoom {
  private readonly _containerSize: MaybeRefOrGetter<Size>
  private readonly _mediaProps: MaybeRefOrGetter<{ frameRate: number; duration: number }>
  private readonly _spp = ref(INITIAL_SECONDS_PER_PIXEL)

  constructor(
    containerSize: MaybeRefOrGetter<Size>,
    mediaProps: MaybeRefOrGetter<{ frameRate: number; duration: number }>,
  ) {
    this._containerSize = containerSize
    this._mediaProps = mediaProps
  }

  get min(): number {
    return 10 / toValue(this._mediaProps).frameRate / toValue(this._containerSize).width
  }
  get max(): number {
    return Math.max(0, toValue(this._mediaProps).duration / toValue(this._containerSize).width) * 4
  }

  get secondsPerPixel(): number {
    return this._spp.value
  }
  set secondsPerPixel(value) {
    this._spp.value = clamp(value, this.min, this.max)
  }
  get zeroToOne(): number {
    return remap(this._spp.value, this.min, this.max, 1, 0) ** 2
  }
  set zeroToOne(value) {
    this.secondsPerPixel = remap(Math.sqrt(value), 1, 0, this.min, this.max)
  }

  bump(decrease: boolean): void {
    this.secondsPerPixel **= 1 + PPS_CHANGE_AMOUNT * (decrease ? -1 : 1)
  }

  inc(): void {
    this.bump(false)
  }

  dec(): void {
    this.bump(true)
  }

  secondsToPixels(time: number): number {
    return time / this.secondsPerPixel
  }

  pixelsToSeconds(offset: number): number {
    return offset * this.secondsPerPixel
  }
}
