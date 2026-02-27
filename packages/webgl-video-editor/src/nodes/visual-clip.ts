import { type Ref, ref } from 'fine-jsx'

import type { Schema } from '../../types/core.d.ts'
import type * as pub from '../../types/core.d.ts'
import type { VideoEffectAsset } from '../assets.ts'

import { Clip } from './clip.ts'

interface Point {
  x: number
  y: number
}
const pointsAreEqual = (a?: Point, b?: Point): boolean =>
  (!a && !b) || (!!a && !!b && a.x === b.x && a.y === b.y)

export class VisualClip extends Clip<Schema.VisualClip> implements pub.VisualClip {
  declare clipType: 'video'

  declare position: { x: number; y: number }
  declare rotation: number
  declare scale: { x: number; y: number }

  declare filter: Schema.VisualClip['filter']

  declare _filter: Ref<VideoEffectAsset | undefined>
  declare _filterIntensity: Ref<number>

  get isReady(): boolean {
    return super.isReady && !this._filter.value?.isLoading
  }

  protected _init(init: Schema.VisualClip): void {
    super._init(init)

    this._filter = ref<VideoEffectAsset>()
    this._filterIntensity = ref(1)

    const reactivePointOptions = {
      equal: pointsAreEqual,
    }
    this._defineReactive('position', init.position, { ...reactivePointOptions, defaultValue: { x: 0, y: 0 } })
    this._defineReactive('rotation', init.rotation, { defaultValue: 0 })
    this._defineReactive('scale', init.scale, { ...reactivePointOptions, defaultValue: { x: 1, y: 1 } })

    this._defineReactive('filter', init.filter, {
      onChange: (value) => {
        this._filterIntensity.value = value?.intensity ?? 1

        if (value?.assetId === this._filter.value?.id) return

        this._filter.value = value ? (this.doc.assets.get(value.assetId) as VideoEffectAsset) : undefined
      },
      equal: (a, b) => (!a && !b) || (!!a && !!b && a.assetId === b.assetId && a.intensity === b.intensity),
    })
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- --
  isVisual(): this is VisualClip {
    return true
  }

  toObject(): Schema.VisualClip {
    const { position, rotation, scale, filter } = this
    const obj: Schema.VisualClip = super.toObject() as Schema.BaseClip & { clipType: 'video' }

    if (position.x !== 0 || position.y !== 0) obj.position = position
    if (rotation !== 0) obj.rotation = rotation
    if (scale.x !== 1 || scale.y !== 1) obj.scale = scale
    if (filter) obj.filter = { assetId: filter.assetId, intensity: filter.intensity }

    return obj
  }
}
