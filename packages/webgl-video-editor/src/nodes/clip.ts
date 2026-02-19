import { effect, ref, type Ref, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import { createHiddenMediaElement, whenLoadedMetadata } from 'shared/utils'
import { useMediaError } from 'shared/video/utils'

import type { RootNode } from '../../types/internal.ts'
import type { MediaAsset, VideoEffectAsset } from '../assets.ts'
import { NodeCreateEvent } from '../events.ts'
import { MiruFilter } from '../pixi/pixi-miru-filter.ts'

import { BaseClip } from './base-clip.ts'
import { ClipPlayback } from './clip-playback.ts'
import type { Schema } from './index.ts'

export class Clip extends BaseClip {
  media = ref<HTMLVideoElement | HTMLAudioElement>(document.createElement('video'))
  readonly #source = ref<MediaAsset>(undefined as never)
  declare source: Schema.Clip['source']
  error: Ref<MediaError | undefined>
  rendererNode = new Pixi.Sprite(new Pixi.Texture())

  readonly #filter = ref<VideoEffectAsset>()
  readonly #filterIntensity = ref(1)

  readonly playback = new ClipPlayback(this)

  get start(): number {
    return this.sourceStart
  }

  get sourceAsset(): MediaAsset {
    return this.#source.value
  }
  set sourceAsset(asset: MediaAsset) {
    this.#setMedia(asset)
  }

  get isReady(): boolean {
    return this.playback.mediaState.isReady.value && !this.sourceAsset.isLoading
  }

  get everHadEnoughData(): boolean {
    return this.playback.mediaState.wasEverPlayable.value
  }

  declare filter: Schema.Clip['filter']
  _pixiFilters: MiruFilter[] = []

  constructor(init: Schema.Clip, root: RootNode) {
    super(init, root)

    this._defineReactive('source', init.source, {
      onChange: (value) => (this.sourceAsset = this.root.assets.get(value.assetId) as MediaAsset),
      equal: (a, b) => a.assetId === b.assetId,
    })
    this._defineReactive('filter', init.filter, {
      onChange: (value) => {
        this.#filterIntensity.value = value?.intensity ?? 1

        if (value?.assetId === this.#filter.value?.id) return

        this._pixiFilters.forEach((filter) => filter.destroy())
        this._pixiFilters.length = 0

        this.#filter.value = value && (this.root.assets.get(value.assetId) as VideoEffectAsset)

        this.rendererNode.filters = this._pixiFilters =
          this.#filter.value?.raw.ops.map((op) => new MiruFilter(op, this.#filterIntensity)) ?? []

        this._pixiFilters.forEach((filter) =>
          filter.sprites.forEach((sprite) => this.root.stage.addChild(sprite)),
        )
      },
      equal: (a, b) => (!a && !b) || (!!a && !!b && a.assetId === b.assetId && a.intensity === b.intensity),
    })

    this.transition = init.transition

    this.error = useMediaError(this.media)

    this.scope.run(() => {
      // keep media URL updated
      watch(
        [() => this.sourceAsset.objectUrl, () => this.sourceAsset.isLoading, () => this.parent?.trackType],
        ([url, loading, trackType], _prev, onCleanup) => {
          if (loading || !trackType) return
          this.#unloadCurrentMedia()

          const mediaElement = (this.media.value = createHiddenMediaElement(trackType, url))
          const { rendererNode } = this

          let isStale = false
          onCleanup(() => (isStale = true))

          void whenLoadedMetadata(mediaElement).then(() => {
            if (isStale) return

            if (trackType === 'video') {
              const { texture } = rendererNode
              texture.source = new Pixi.ImageSource({ resource: mediaElement as HTMLVideoElement })
              texture.update()
            }
          })
        },
      )

      // make sure media type matches parent track type
      watch([() => this.parent], () => this.#setMedia(this.sourceAsset))

      effect(() => this.resizeSprite(this.rendererNode))
    })

    this.onDispose(this.#unloadCurrentMedia.bind(this, true))
    this.onDispose(() => {
      this._pixiFilters.forEach((filter) =>
        filter.sprites.forEach((sprite) => this.root.stage.addChild(sprite)),
      )
    })
    root._emit(new NodeCreateEvent(this))
  }

  connect() {
    const { parent } = this

    if (parent?.trackType === 'video') {
      const { rendererNode } = this
      if (parent.container !== rendererNode.parent) parent.container.addChild(rendererNode)
      rendererNode.zIndex = this.index
    }
  }

  disconnect() {
    this.rendererNode.removeFromParent()
  }

  #setMedia(asset: MediaAsset) {
    this.#source.value = asset
    this.rendererNode.visible = false
  }

  #unloadCurrentMedia(dispose?: boolean) {
    const mediaElement = this.media.value
    mediaElement.removeAttribute('src')
    mediaElement.remove()

    this.rendererNode.visible = false
    if (dispose) this.rendererNode.destroy(true)
    else this.rendererNode.texture.source.unload()
  }

  _ensureDurationIsPlayable() {
    super._ensureDurationIsPlayable(this.sourceAsset.duration)
  }
}
