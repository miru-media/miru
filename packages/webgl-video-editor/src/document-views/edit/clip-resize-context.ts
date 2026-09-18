import { ref } from 'fine-jsx'

import type * as pub from '#core'
import { Rational } from 'shared/utils/math.ts'

import { ensureDurationIsPlayable } from '../../components/utils.ts'

import type { EditNodeLink } from './edit-node-link.ts'
import type { EditView } from './edit-nodes.ts'

const GAPPED = true as boolean

export const enum ClipPos {
  Prev = 0,
  Cur = 1,
  Next = 2,
}

type ClipResizeClips = [
  prev: EditView.AnyClip | undefined,
  self: EditView.AnyClip,
  next?: EditView.AnyClip | undefined,
]

export class ClipResizeContext {
  readonly #isResizing = ref(false)

  docDuration = ref(0)
  clips: ClipResizeClips = [undefined, undefined as never, undefined]
  linkedClips: ClipResizeClips[] = []

  get clip(): EditView.AnyTrackChild | undefined {
    return this.isActive() ? this.clips[ClipPos.Cur] : undefined
  }

  isActive(): this is ClipResizeContextIsActive {
    return this.#isResizing.value
  }

  // change a value in the context of the target clip and all linked clips
  changeResizedValue<Key extends 'duration' | 'sourceStart' | 'gap'>(
    position: ClipPos,
    key: Key,
    delta: pub.AnyClip[Key],
  ): void {
    this.linkedClips.forEach((adjacentClips) => {
      const clip = adjacentClips[position]
      if (clip) clip[key] = clip[key].add(delta)
    })
  }

  start(clip: EditView.AnyClip): void {
    const { doc } = clip

    this.docDuration.value = doc.duration

    const { prev, next } = clip
    this.clips = [prev, clip, next]
    this.linkedClips = (clip.link as EditNodeLink<pub.AnyClip> | undefined)?.nodes.map((clip) => [
      clip.prev,
      clip,
      clip.next,
    ]) ?? [this.clips]

    this.#isResizing.value = true
  }

  getOuterLimit(): { start: number; end: number } {
    if (!this.isActive()) return { start: 0, end: 0 }

    const mainClip = this.clips[ClipPos.Cur]
    let minLinkedStartTime = -Infinity
    let maxLinkedEndTime = Infinity

    this.linkedClips.forEach(([prev, clip]) => {
      const { time, asset } = clip
      const mediaDuration = asset?.type === 'asset:media:av' ? asset.duration : undefined
      const minStartTime = Math.max(
        mediaDuration == null ? 0 : time.end - mediaDuration,
        GAPPED ? (prev?.time.end ?? 0) : Math.max(0, prev ? prev.time.start + 1 / clip.doc.frameRate : 0),
      )
      const maxEndTime = Math.min(
        mediaDuration == null ? Infinity : time.start + mediaDuration,
        GAPPED ? (clip.next?.time.start ?? Infinity) : Infinity,
      )

      minLinkedStartTime = Math.max(
        minLinkedStartTime,
        minStartTime - (clip.time.start - mainClip.time.start),
      )
      maxLinkedEndTime = Math.min(maxLinkedEndTime, maxEndTime - (clip.time.end - mainClip.time.end))
    })

    return { start: minLinkedStartTime, end: maxLinkedEndTime }
  }

  getInnerLimit(): { start: number; end: number } {
    if (!this.isActive()) return { start: 0, end: 0 }

    const minLinkedClipDuration = this.linkedClips.reduce(
      (acc, { [ClipPos.Cur]: clip }) => Math.min(acc, clip.duration.valueOf()),
      Infinity,
    )

    const mainClip = this.clips[ClipPos.Cur]
    const { time } = mainClip
    const singleFrameS = 1 / mainClip.doc.frameRate

    return {
      start: time.start + minLinkedClipDuration - singleFrameS,
      end: time.end - minLinkedClipDuration + singleFrameS,
    }
  }

  move(start: number, end: number, edges: { left: boolean; right: boolean }) {
    if (!this.isActive()) return

    const [prev, clip, next] = this.clips

    const { frameRate } = clip.doc
    const { duration } = clip
    const newStart = Rational.fromDecimal(start, frameRate)
    const newDuration = Rational.fromDecimal(end, frameRate)
    const delta = newDuration.subtract(duration)
    const minusDelta = new Rational(-delta.value, delta.rate)

    if (edges.left) this.changeResizedValue(ClipPos.Cur, 'sourceStart', minusDelta)

    this.changeResizedValue(ClipPos.Cur, 'duration', delta)

    if (GAPPED) {
      if (edges.left) this.changeResizedValue(ClipPos.Cur, 'gap', minusDelta)
      else if (next) this.changeResizedValue(ClipPos.Next, 'gap', minusDelta)
    } else {
      if (edges.right) this.linkedClips.forEach(({ [ClipPos.Cur]: clip }) => ensureDurationIsPlayable(clip))
      if (prev)
        this.changeResizedValue(
          ClipPos.Prev,
          'duration',
          newStart.subtract(Rational.fromDecimal(-prev.time.start, frameRate)).subtract(clip.duration),
        )
    }
  }

  end() {
    if (!this.isActive()) return

    this.#isResizing.value = false
    this.docDuration.value = 0
    this.linkedClips.forEach((clips) => clips.forEach((clip) => clip?._applyEdits()))

    this.cancel()
  }

  cancel() {
    const { clips, linkedClips } = this
    ;(clips as unknown[]).length = linkedClips.length = 0
  }
}

interface ClipResizeContextIsActive extends ClipResizeContext {
  clip: NonNullable<ClipResizeContext['clip']>
}
