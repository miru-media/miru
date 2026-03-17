import { computed, ref, type Ref } from 'fine-jsx'

import type { ClipTime, ClipTimeRational, Schema } from '#core'
import type * as pub from '#core'
import type { Size } from 'shared/types.ts'
import { clamp, Rational } from 'shared/utils/math.ts'
import { rangeContainsTime } from 'shared/video/utils.ts'

import { VIDEO_PREPLAY_TIME_S } from '../constants.ts'

import { TrackChild } from './track-child.ts'

export abstract class Clip<T extends Schema.AnyClip = Schema.AnyClip>
  extends TrackChild<T>
  implements pub.Clip<T>
{
  declare readonly type: 'clip'
  abstract clipType: T['clipType']
  declare children: undefined

  declare sourceStart: Rational
  declare private _asset: Ref<pub.MediaAsset | undefined>
  declare mediaRef: T['mediaRef']
  declare error: Ref<MediaError | undefined>

  declare transition: Schema.AnyClip['transition']

  declare private _presentationTime: Ref<ClipTime>
  declare private _playableTime: Ref<ClipTime>
  readonly #expectedMediaTime = computed((): number => {
    const { start, source, duration } = this.playableTime
    return clamp(this.doc.currentTime - start + source, source, source + duration)
  })
  readonly #isInClipTime = computed(() => rangeContainsTime(this.presentationTime, this.doc.currentTime))

  declare private _mediaSize: Ref<Size>
  get asset(): pub.MediaAsset | undefined {
    return this._asset.value
  }

  get isReady(): boolean {
    return this.asset?.isLoading === false
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

  protected _init(init: T): void {
    super._init(init)
    this._asset = ref<pub.MediaAsset>()

    this._defineReactive('mediaRef', init.mediaRef, {
      onChange: (value) =>
        (this._asset.value = value?.assetId ? this.doc.assets.getAsset(value.assetId) : undefined),
      equal: (a, b) => a?.assetId === b?.assetId,
    })
    this._defineReactive('sourceStart', init.sourceStart, { transform: Rational.from })

    this.clipType = init.clipType

    this._presentationTime = computed(() => this._computePresentationTime())
    this._playableTime = computed(() => this._computePlayableTime())

    this._mediaSize = computed((): Size => {
      const video = this.asset?.video
      if (!video) return { width: 1, height: 1 }

      const { width, height } = video
      return video.rotation % 180 ? { width: height, height: width } : { width, height }
    })

    this.doc.assets.on(
      'asset:create',
      ({ asset }) => {
        if (asset.id === this.mediaRef?.assetId && asset.type === 'asset:media:av') this._asset.value = asset
      },
      { signal: this._abort.signal },
    )
  }

  _computeTimeRational(): ClipTimeRational {
    const prevTime = this.prev?.timeRational
    const start = prevTime ? prevTime.end : Rational.ZERO
    const end = start.add(this.duration)

    const { duration } = this
    const source = this.sourceStart
    return { start, source, duration, end }
  }

  _computePresentationTime(): ClipTime {
    const { time, prev } = this
    const inTransition = prev?.isClip() ? prev.transition : undefined
    if (!inTransition) return time

    const inTransitionDuration = inTransition.duration.value - inTransition.duration.rate

    const start = time.start - inTransitionDuration
    const source = time.source - inTransitionDuration
    const duration = time.duration + inTransitionDuration

    return { start, source, duration, end: start + duration }
  }

  _computePlayableTime(): ClipTime {
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
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isClip(): this is pub.AnyClip {
    return true
  }
  isTrackChild(): this is pub.AnyTrackChild {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): Pick<T, keyof Schema.BaseClip> {
    return {
      ...super.toJSON(),
      clipType: this.clipType,
      sourceStart: this.sourceStart,
      mediaRef: this.mediaRef,
      duration: this.duration,
      transition: this.transition,
    }
  }
}
