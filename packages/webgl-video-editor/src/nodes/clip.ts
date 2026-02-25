import { ref, type Ref, watch } from 'fine-jsx'

import { createHiddenMediaElement } from 'shared/utils'
import { useMediaError } from 'shared/video/utils'

import type { RootNode } from '../../types/internal'
import type { MediaAsset } from '../assets.ts'

import { BaseClip } from './base-clip.ts'
import { ClipPlayback } from './clip-playback.ts'
import type { Schema } from './index.ts'

export abstract class Clip<T extends Schema.BaseClip = Schema.AnyClip> extends BaseClip<T> {
  media = ref<HTMLVideoElement | HTMLAudioElement>(document.createElement('video'))
  declare private _source: Ref<MediaAsset>
  declare source: Schema.BaseClip['source']
  declare error: Ref<MediaError | undefined>

  readonly playback = new ClipPlayback(this)

  get sourceAsset(): MediaAsset {
    return this._source.value
  }
  set sourceAsset(asset: MediaAsset) {
    this._setMedia(asset)
  }

  get isReady(): boolean {
    return this.playback.mediaState.isReady.value && !this.sourceAsset.isLoading
  }

  get everHadEnoughData(): boolean {
    return this.playback.mediaState.wasEverPlayable.value
  }

  constructor(init: T, root: RootNode) {
    super(init, root)

    this.transition = init.transition

    this.error = useMediaError(this.media)

    this.onDispose(this.#onDispose.bind(this))
  }

  protected _init(init: T): void {
    super._init(init)
    this._source = ref<MediaAsset>(undefined as never)

    this._defineReactive('source', init.source, {
      onChange: (value) => (this.sourceAsset = this.root.assets.get(value.assetId) as MediaAsset),
      equal: (a, b) => a.assetId === b.assetId,
    })

    this.scope.run(() => {
      // keep media URL updated
      watch(
        [() => this.sourceAsset.objectUrl, () => this.sourceAsset.isLoading, () => this.parent?.trackType],
        ([url, loading, trackType], _prev) => {
          if (loading || !trackType) return
          this.#unloadCurrentMedia()
          this.media.value = createHiddenMediaElement(trackType, url)
        },
      )

      // make sure media type matches parent track type
      watch([() => this.parent], () => this._setMedia(this.sourceAsset))
    })
  }

  private _setMedia(asset: MediaAsset): void {
    this._source.value = asset
    if (this.container) this.container.visible = false
  }

  #unloadCurrentMedia(): void {
    const mediaElement = this.media.value
    mediaElement.removeAttribute('src')
    mediaElement.remove()

    if (this.container) this.container.visible = false
  }

  #onDispose(): void {
    this.#unloadCurrentMedia()
  }

  _ensureDurationIsPlayable(): void {
    super._ensureDurationIsPlayable(this.sourceAsset.duration)
  }
}
