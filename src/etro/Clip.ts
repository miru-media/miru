import { EffectInternal } from '@/Effect'
import { createEffectScope, effect, onScopeDispose, ref, Ref, watch } from '@/framework/reactivity'
import { Renderer } from '@/renderer/Renderer'
import { AssetType, ImageSourceOption } from '@/types'
import { decodeAsyncImageSource, isSyncSource, normalizeSourceOption } from '@/utils'

import { EtroVideo } from './EtroVideo'

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Clip {
  export interface Init {
    time: ClipTime
    x: number
    y: number
    width: number
    height: number
    source: ImageSourceOption
    effects: EffectInternal[]
  }
}

interface ClipTime {
  start: number
  source: number
  duration: number
}

export class Clip {
  time: Ref<ClipTime>
  x: Ref<number>
  y: Ref<number>
  width: Ref<number>
  height: Ref<number>
  media: Ref<HTMLVideoElement>
  effects: Ref<EffectInternal[]>

  etro = ref<EtroVideo>(undefined as never)

  #scope = createEffectScope()

  constructor(init: Clip.Init, renderer: Renderer) {
    this.time = ref(init.time)
    this.x = ref(init.x)
    this.y = ref(init.y)
    this.width = ref(init.width)
    this.height = ref(init.height)
    this.effects = ref(init.effects)

    const sourceOption = normalizeSourceOption(init.source, AssetType.Video)

    if (sourceOption.source instanceof HTMLVideoElement) this.media = ref(sourceOption.source)
    else {
      if (isSyncSource(sourceOption.source)) {
        throw new Error('[miru] expected video source')
      }

      const { media, close } = decodeAsyncImageSource(sourceOption.source, sourceOption.crossOrigin, true)

      this.#scope.run(() => {
        onScopeDispose(close)
      })

      this.media = ref(media)
    }

    this.#scope.run(() => {
      watch([this.media], ([media]) => {
        this.etro.value = new EtroVideo(
          {
            source: media,
            startTime: 0,
            duration: this.time.value.duration,
            x: () => this.x.value,
            y: () => this.y.value,
            width: () => this.width.value,
            height: () => this.height.value,
          },
          this.effects,
          renderer,
        )
      })

      effect(() => {
        const { start, source, duration } = this.time.value
        this.etro.value.startTime = start
        this.etro.value.sourceStartTime = source
        this.etro.value.duration = duration
      })
    })
  }
}
