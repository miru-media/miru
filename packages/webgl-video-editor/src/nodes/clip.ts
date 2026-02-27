import { computed, ref, type Ref } from 'fine-jsx'

import type { Size } from 'shared/types.ts'
import { clamp } from 'shared/utils/math.ts'
import { rangeContainsTime } from 'shared/video/utils.ts'

import type { ClipTime } from '../../types/core.d.ts'
import type * as pub from '../../types/core.d.ts'
import type { MediaAsset } from '../assets.ts'
import { TRANSITION_DURATION_S, VIDEO_PREPLAY_TIME_S } from '../constants.ts'

import type { Schema } from './index.ts'
import { TrackChild } from './track-child.ts'

export abstract class Clip<T extends Schema.AnyClip = Schema.AnyClip>
  extends TrackChild<T>
  implements pub.Clip<T>
{
  declare readonly type: 'clip'
  abstract clipType: T['clipType']
  declare children: undefined
  declare name: string

  declare sourceStart: Schema.AnyClip['sourceStart']
  declare private _source: Ref<MediaAsset>
  declare source: Schema.AnyClip['source']
  declare error: Ref<MediaError | undefined>

  declare transition: Schema.AnyClip['transition']
  declare private _time: Ref<ClipTime>

  declare _presentationTime: Ref<ClipTime>
  declare _playableTime: Ref<ClipTime>
  readonly #expectedMediaTime = computed((): number => {
    const { start, source, duration } = this.playableTime
    return clamp(this.doc.currentTime - start + source, source, source + duration)
  })
  readonly #isInClipTime = computed(() => rangeContainsTime(this.presentationTime, this.doc.currentTime))

  declare private _mediaSize: Ref<Size>
  get sourceAsset(): MediaAsset {
    return this._source.value
  }

  get isReady(): boolean {
    return !this.sourceAsset.isLoading
  }

  get time(): ClipTime {
    return this._time.value
  }
  get presentationTime(): ClipTime {
    return this._presentationTime.value
  }
  get playableTime(): ClipTime {
    return this._playableTime.value
  }
  get expectedMediaTime(): number {
    return this.#expectedMediaTime.value
  }
  get isInClipTime(): boolean {
    return this.#isInClipTime.value
  }

  get mediaSize(): Size {
    return this._mediaSize.value
  }

  constructor(doc: pub.Document, init: T) {
    super(doc, init)

    this.transition = init.transition
  }

  protected _init(init: T): void {
    super._init(init)
    this._source = ref<MediaAsset>(undefined as never)

    this._defineReactive('source', init.source, {
      onChange: (value) => (this._source.value = this.doc.assets.get(value.assetId) as MediaAsset),
      equal: (a, b) => a.assetId === b.assetId,
    })
    this._defineReactive('name', init.name)
    this._defineReactive('sourceStart', init.sourceStart)
    this._defineReactive('transition', init.transition)

    this.clipType = init.clipType

    this._time = computed((): ClipTime => {
      const prevTime = this.prev?.time
      const start = prevTime ? prevTime.start + prevTime.duration : 0
      const end = start + this.duration

      const { duration } = this
      const source = this.sourceStart
      return { start, source, duration, end }
    })
    this._presentationTime = computed((): ClipTime => {
      const { time, prev } = this
      const inTransitionDuration = prev?.isClip() && prev.transition ? TRANSITION_DURATION_S : 0

      const start = time.start - inTransitionDuration
      const source = time.source - inTransitionDuration
      const duration = time.duration + inTransitionDuration

      return { start, source, duration, end: start + duration }
    })
    this._playableTime = computed((): ClipTime => {
      const presentation = this._presentationTime.value
      if (presentation.source >= 0) return presentation

      const { start, end, source, duration } = presentation
      const preplayDuration = Math.max(0, start - Math.min(VIDEO_PREPLAY_TIME_S, source))

      return {
        start: start - preplayDuration,
        source: source - preplayDuration,
        duration: duration + preplayDuration,
        end,
      }
    })

    this._mediaSize = computed((): Size => {
      const { video } = this.sourceAsset
      if (!video) return { width: 0, height: 0 }

      const { width, height } = video
      return video.rotation % 180 ? { width: height, height: width } : { width, height }
    })
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isClip(): this is pub.AnyClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toObject(): Schema.BaseClip {
    return {
      id: this.id,
      type: 'clip',
      clipType: this.clipType,
      sourceStart: this.sourceStart,
      source: this.source,
      duration: this.duration,
      transition: this.transition,
    }
  }
}
