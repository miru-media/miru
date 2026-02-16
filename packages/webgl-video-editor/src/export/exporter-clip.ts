import { ref } from 'fine-jsx'
import type { Sprite } from 'pixi.js'

import type { MediaAsset, VideoEffectAsset } from '../assets.ts'
import { BaseClip } from '../nodes/base-clip.ts'
import type { Schema, Track } from '../nodes/index.ts'

import { MediaExtractor } from './media-extractor.ts'

export class ExporterClip extends BaseClip {
  readonly videoEffect: VideoEffectAsset | undefined
  readonly #filterIntensity = ref(1)
  sourceAsset: MediaAsset
  source: Schema.Clip['source']
  extractor: MediaExtractor

  get filter(): BaseClip['filter'] {
    const effect = this.videoEffect
    return effect && { assetId: effect.id, intensity: this.#filterIntensity.value }
  }

  get isReady(): boolean {
    return this.extractor.videoIsReady
  }
  get everHadEnoughData(): boolean {
    return this.isReady
  }

  constructor(init: Schema.Clip, track: Track) {
    super(init, track.root)

    const { root } = this

    this.source = init.source
    this.sourceAsset = root.assets.get(init.source.assetId) as MediaAsset
    this.videoEffect = init.filter && (root.assets.get(init.filter.assetId) as VideoEffectAsset)
    this.#filterIntensity.value = init.filter?.intensity ?? 1
    this.transition = init.transition

    this.extractor = new MediaExtractor(this)
  }

  resizeSprite(sprite: Sprite): void {
    super.resizeSprite(sprite, true)
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this, @typescript-eslint/no-empty-function -- stubs */
  connect() {}
  disconnect() {}
  /* eslint-enable @typescript-eslint/class-methods-use-this, @typescript-eslint/no-empty-function */
}
