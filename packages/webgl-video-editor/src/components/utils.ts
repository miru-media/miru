import { computed } from 'fine-jsx'
import { inject, provide } from 'fine-jsx/jsx-runtime'

import type * as pub from '#core'
import type { AnyClip } from '#core'
import { Rational } from 'shared/utils/math.ts'

import type { VideoEditor } from '../video-editor.ts'

const VIDEO_EDITOR_CONTEXT = Symbol('video-editor-context')

export const useEditor = (): VideoEditor => inject<VideoEditor>(VIDEO_EDITOR_CONTEXT)!
export const provideEditor = (editor: VideoEditor): void => provide(VIDEO_EDITOR_CONTEXT, editor)

export const ensureDurationIsPlayable = (clip: AnyClip): void => {
  const { asset } = clip
  if (!asset) return

  const docFrameRate = clip.doc.frameRate
  const sourceDuration = Rational.fromDecimal(asset.duration, docFrameRate)
  const durationOutsideClip = sourceDuration.subtract(clip.sourceStart.add(clip.duration))
  const { sourceStart } = clip
  clip.sourceStart = sourceStart.add(durationOutsideClip)

  clip.duration = Rational.min(clip.duration, sourceDuration)
}

export const getClipAtTime = (track: pub.Track, time: number): pub.AnyClip | undefined => {
  for (let clip = track.head; clip; clip = clip.next) {
    const { start, end } = clip.time
    if (start <= time && time < end) return clip
  }
}

export const useTrackChildEdges = (editor: VideoEditor, node: pub.AnyTrackChild) =>
  computed(() => {
    const { start, duration } = node.time
    const left = editor.secondsToPixels(start)
    const right = left + editor.secondsToPixels(duration)

    return { left, right }
  })

export const moveAndFillGaps = (
  node: pub.AnyTrackChild,
  position: pub.ChildNodePosition,
  newStart: Rational,
) => {
  const nodeAtPosition = getNodeAtTargetPosition<pub.AnyTrackChild>(node.doc, position)
  const nodeBeforePosition = nodeAtPosition
    ? nodeAtPosition.prev
    : node.doc.nodes.get<pub.Track>(position.parentId).children[position.index - 1]
  const newNextNode = node === nodeAtPosition ? node.next : nodeAtPosition
  const newPrevClipEnd = nodeBeforePosition?.timeRational.end ?? Rational.ZERO

  let startGap = Rational.max(newStart.subtract(newPrevClipEnd), Rational.ZERO)
  let endGap =
    newNextNode?.timeRational.start
      .subtract(Rational.max(newStart, newPrevClipEnd))
      .subtract(node.duration) ?? Rational.ZERO
  if (endGap.value < 0) {
    startGap = Rational.max(startGap.add(endGap), Rational.ZERO)
    endGap = Rational.ZERO
  }

  // fill gap at old position
  node.next?.setGap(
    node.prev?.id,
    node.next.timeRational.start.subtract(node.prev?.timeRational.end ?? Rational.ZERO),
  )

  // set start gap at new position
  node.setGap(nodeBeforePosition?.id, startGap)
  // set end gap at new position
  newNextNode?.setGap(node.id, endGap)

  node.move(position)
}

export const moveAndLeaveZeroGap = (node: pub.AnyTrackChild, position: pub.ChildNodePosition) => {
  if (node.parent?.id === position.parentId && node.index === position.index) return
  const { next } = node

  if (next) next.setGap(node.prev?.id, node.gap.add(next.gap))

  node.move(position)
}

export const nodeFitsBetween = (
  node: pub.AnyTrackChild,
  a: pub.AnyTrackChild | undefined,
  b: pub.AnyTrackChild | undefined,
): boolean => !b || b.time.start - (a?.time.end ?? 0) >= node.duration.valueOf()

export const slideNodeBy = (node: pub.AnyTrackChild, delta: Rational) => {
  const newGap = Rational.clamp(
    node.gap.add(delta),
    Rational.ZERO,
    node.next ? node.next.gap.add(node.gap) : Rational.INFINITY,
  )
  const deltaGap = newGap.subtract(node.gap)

  node.next?.setGap(node.id, node.next.gap.subtract(deltaGap))
  node.gap = newGap
}

export const getNodeAtTargetPosition = <T extends pub.AnyNode>(
  doc: pub.Document,
  position: pub.ChildNodePosition,
): T | undefined => doc.nodes.get<pub.Track>(position.parentId).children[position.index] as T
