import type { EffectOp } from 'webgl-effects'

import type * as pub from '#core'

import { BaseAsset } from './base-asset.ts'

export class VideoEffectAsset extends BaseAsset<pub.Schema.VideoEffectAsset> implements pub.VideoEffectAsset {
  readonly type = 'asset:effect:video' as const

  shaders: string[] = []

  get name(): string {
    return this.raw.name
  }
  get ops(): EffectOp[] {
    return this.raw.ops
  }

  toObject(): pub.Schema.VideoEffectAsset {
    return {
      ...this.raw,
      name: this.name,
      id: this.id,
      type: 'asset:effect:video',
    }
  }
}
