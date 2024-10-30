import VideoContext, { VideoNode } from 'videocontext'

import { EffectInternal } from '@/Effect'
import { createEffectScope, effect, onScopeDispose, ref, Ref } from '@/framework/reactivity'
import { AssetType, ImageSourceOption } from '@/types'
import { decodeAsyncImageSource, isSyncSource, normalizeSourceOption, useEventListener } from '@/utils'

import { useMediaError } from './utils'

export enum SourceNodeState {
  waiting = 0,
  sequenced = 1,
  playing = 2,
  paused = 3,
  ended = 4,
  error = 5,
}

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

  node = ref<VideoNode>(undefined as never)
  latestEvent = ref<Event>()
  error: Ref<MediaError | undefined>

  #scope = createEffectScope()

  constructor(init: Clip.Init, context: VideoContext) {
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

    this.error = useMediaError(this.media)
    const allEventTypes = [
      'abort',
      'canplay',
      'canplaythrough',
      'durationchange',
      'emptied',
      'encrypted',
      'ended',
      'error',
      'loadeddata',
      'loadedmetadata',
      'loadstart',
      'pause',
      'play',
      'playing',
      'progress',
      'ratechange',
      'seeked',
      'seeking',
      'stalled',
      'suspend',
      'timeupdate',
      'volumechange',
      'waiting',
    ]
    allEventTypes.forEach((type) =>
      useEventListener(this.media, type, (event) => (this.latestEvent.value = event)),
    )

    this.#scope.run(() => {
      effect(() => {
        const time = this.time.value
        const node = (this.node.value = context.video(this.media.value, time.source))

        node.startAt(time.start)
        node.stopAt(time.start + time.duration)
      })
    })
  }

  toObject(): Clip.Init {
    const { time, x, y, width, height } = this
    return {
      time: time.value,
      x: x.value,
      y: y.value,
      width: width.value,
      height: height.value,
      source: this.media.value.src,
      effects: [],
    }
  }
}
