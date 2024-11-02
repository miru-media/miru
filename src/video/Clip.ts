import VideoContext from 'videocontext'

import { EffectInternal } from '@/Effect'
import { createEffectScope, effect, onScopeDispose, ref, Ref, watch } from '@/framework/reactivity'
import { Renderer } from '@/renderer/Renderer'
import { AssetType, Effect, ImageSourceOption } from '@/types'
import { decodeAsyncImageSource, isSyncSource, normalizeSourceOption, useEventListener } from '@/utils'

import { MiruVideoNode } from './custom'
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
    filter?: Effect
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
  media = ref<HTMLVideoElement>(undefined as never)
  filter: Ref<EffectInternal | undefined>

  node = ref<MiruVideoNode>(undefined as never)
  latestEvent = ref<Event>()
  error: Ref<MediaError | undefined>

  #scope = createEffectScope()

  constructor(init: Clip.Init, context: VideoContext, renderer: Renderer) {
    this.time = ref(init.time)
    this.x = ref(init.x)
    this.y = ref(init.y)
    this.width = ref(init.width)
    this.height = ref(init.height)
    this.filter = ref(init.filter && new EffectInternal(init.filter, renderer))

    this.setMedia(init.source)

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
      watch([this.media], ([media], _prev, onCleanup) => {
        const time = this.time.value
        const node = (this.node.value = context.customSourceNode(
          MiruVideoNode,
          media,
          time.source,
          undefined,
          { renderer },
        ))

        onCleanup(() => node.destroy())
      })

      effect(() => {
        const node = this.node.value
        const time = this.time.value

        node._sourceOffset = time.source
        node.clearTimelineState()
        node.startAt(time.start)
        node.stopAt(time.start + time.duration)
        node._seek(context.currentTime)
      })

      effect(() => (this.node.value.effect = this.filter.value))
    })
  }

  setTime(value: Partial<ClipTime>) {
    this.time.value = { ...this.time.value, ...value }
  }

  setMedia(value: ImageSourceOption) {
    const sourceOption = normalizeSourceOption(value, AssetType.Video)

    if (sourceOption.source instanceof HTMLVideoElement) this.media.value = sourceOption.source
    else {
      if (isSyncSource(sourceOption.source)) {
        throw new Error('[miru] expected video source')
      }

      const { media, close } = decodeAsyncImageSource(sourceOption.source, sourceOption.crossOrigin, true)

      this.#scope.run(() => {
        onScopeDispose(close)
      })

      this.media.value = media
    }
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
      filter: undefined,
    }
  }
}
