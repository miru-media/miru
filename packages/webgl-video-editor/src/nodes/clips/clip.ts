import { computed, type Ref } from 'fine-jsx'

import { NODE_FIELD_FLAGS, VIDEO_PREPLAY_TIME_S } from '#constants'
import type { ClipTime, ClipTimeRational, Schema } from '#core'
import type * as pub from '#core'
import type { NonOverlappingUnion } from '#internal'
import { clamp, Rational } from 'shared/utils/math.ts'
import { rangeContainsTime } from 'shared/video/utils.ts'

import { TrackChild } from '../track-child.ts'

export interface Clip<T extends Schema.AnyClip> extends NonOverlappingUnion<TrackChild<T>, pub.Clip> {}

export abstract class Clip<T extends Schema.AnyClip = Schema.AnyClip>
  extends TrackChild<T>
  implements pub.Clip
{
  static FIELDS = super.FIELDS.concat([
    { key: 'sourceStart', flags: 0, transform: Rational.from },
    { key: 'mediaRef', flags: 0, equal: (a, b) => a?.assetId === b?.assetId },
    { key: 'transition', flags: 0 },

    { key: 'isReady', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'asset', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Asset },
    { key: 'playableTime', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'presentationTime', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'expectedMediaTime', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'isInClipTime', flags: NODE_FIELD_FLAGS.Readonly },

    { key: 'gap', flags: NODE_FIELD_FLAGS.Gap },
  ] satisfies pub.NodeFieldDef<pub.Clip>[])

  static TRANSFORM_FIELDS = [
    { key: 'translateX', flags: 0, defaultValue: 0 },
    { key: 'translateY', flags: 0, defaultValue: 0 },
    { key: 'rotate', flags: 0, defaultValue: 0 },
    { key: 'scaleX', flags: 0, defaultValue: 1 },
    { key: 'scaleY', flags: 0, defaultValue: 1 },
  ] satisfies pub.NodeFieldDef<Schema.TransformProps>[]

  declare readonly children: undefined

  declare private _asset: Ref<pub.MediaAsset | undefined>
  declare mediaRef: T['mediaRef']
  declare error: Ref<MediaError | undefined>

  declare private _presentationTime: Ref<ClipTime>
  declare private _playableTime: Ref<ClipTime>
  readonly #expectedMediaTime = computed((): number => {
    const { start, source, duration } = this.playableTime
    return clamp(this.doc.currentTime - start + source, source, source + duration)
  })
  readonly #isInClipTime = computed(() => rangeContainsTime(this.presentationTime, this.doc.currentTime))

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

  protected _init(): void {
    super._init()

    this._asset = computed((): pub.MediaAsset | undefined =>
      this.mediaRef?.assetId ? this.doc.assets.getAsset(this.mediaRef.assetId) : undefined,
    )
    this._presentationTime = computed(() => this._computePresentationTime())
    this._playableTime = computed(() => this._computePlayableTime())
  }

  _computeTimeRational(): ClipTimeRational {
    const prevTime = this.prev?.timeRational
    const start = this.gap.add(prevTime ? prevTime.end : Rational.ZERO)
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
      sourceStart: this.sourceStart,
      mediaRef: this.mediaRef,
      duration: this.duration,
      transition: this.transition,
    }
  }

  _transformToJSON<T extends Extract<Schema.AnyClip, Partial<Schema.TransformProps>>>(
    this: Clip<T> & Schema.TransformProps,
  ): Partial<Schema.TransformProps> {
    const { translateX, translateY, rotate, scaleX, scaleY } = this
    const transform: Partial<Schema.TransformProps> = {}

    if (translateX !== 0) transform.translateX = translateX
    if (translateY !== 0) transform.translateY = translateY
    if (rotate !== 0) transform.rotate = rotate
    if (scaleX !== 1) transform.scaleX = scaleX
    if (scaleY !== 1) transform.scaleY = scaleY

    return transform
  }
}
