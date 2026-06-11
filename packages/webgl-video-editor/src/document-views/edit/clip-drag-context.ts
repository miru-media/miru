import { computed, ref } from 'fine-jsx'

import type * as pub from '#core'
import { Rational } from 'shared/utils/math.ts'

import { getNodeAtTargetPosition, moveAndFillGaps } from '../../components/utils.ts'

import type { EditView } from './edit-nodes.ts'

export class ClipDragContext {
  _clip = ref<EditView.AnyTrackChild>()
  _newStart = ref(Rational.ZERO)
  _targetTrack = ref<{ id: string; before: boolean }>()
  _trackType = ref<pub.Track['trackType']>('video')
  _clipWasAloneInTrack = ref(false)
  _gapsAround = computed<[Rational, Rational]>(() => {
    const { clip, newStart } = this
    if (!clip) return [Rational.ZERO, Rational.ZERO]

    const { prev, next } = clip
    const prevClipEnd = prev?.original.timeRational.end ?? Rational.ZERO
    const startGap = newStart.subtract(prevClipEnd)

    let endGap

    if (next) {
      const deltaGap = clip.original.gap.subtract(startGap)
      endGap = next.original.gap.add(deltaGap)
    } else endGap = Rational.ZERO

    return [startGap, endGap]
  })
  _newPosition = computed((): pub.ChildNodePosition | undefined => {
    if (!this.isDragging()) return

    const { clip, targetTrack, newStart } = this

    if (targetTrack.before) return

    const duration = clip.duration.valueOf()
    const newStartTime = newStart.valueOf()
    const newCenterTime = newStartTime + duration / 2
    const track = clip.docView._getNode(clip.doc.nodes.get<pub.Track>(targetTrack.id))

    let insertBefore: EditView.AnyTrackChild | undefined
    const toSameParent = track.id === this.parent.id
    const searchStartingNode = toSameParent ? clip : (track.head as EditView.AnyTrackChild | undefined)

    if (!searchStartingNode) return { parentId: track.id, index: 0 }

    if (!toSameParent) {
      const index = track.children.findIndex((node) => {
        const { start, duration } = node.original.time
        return start + duration / 2 > newCenterTime
      })

      return { parentId: track.id, index: index === -1 ? track.count : index }
    }

    for (let { prev } = searchStartingNode; prev; { prev } = prev) {
      const { start, duration } = prev.original.time
      if (start >= newStartTime || start + duration / 2 >= newCenterTime) insertBefore = prev
      else break
    }

    if (insertBefore) return { parentId: track.id, index: insertBefore.index }

    const newEndTime = newStartTime + duration

    let insertAfter: EditView.AnyClip | undefined
    for (let { next } = searchStartingNode; next; { next } = next) {
      const { end, duration } = next.original.time
      if (end <= newEndTime || end - duration / 2 <= newCenterTime) insertAfter = next
      else break
    }
    if (insertAfter) return { parentId: track.id, index: insertAfter.index + 1 }
  })

  get clip(): EditView.AnyTrackChild | undefined {
    return this._clip.value
  }
  get parent(): pub.AnyTrackChild['parent'] {
    return this._clip.value?.parent
  }
  get newStart(): Rational {
    return this._newStart.value
  }
  set newStart(value) {
    this._newStart.value = value
  }
  get targetTrack(): this['_targetTrack']['value'] {
    return this._targetTrack.value
  }
  set targetTrack(value) {
    this._targetTrack.value = value
  }
  get trackType(): pub.Track['trackType'] {
    return this._trackType.value
  }
  get clipWasAloneInTrack(): boolean {
    return this._clipWasAloneInTrack.value
  }

  isDragging(): this is ClipDragContextIsDragging {
    return !!this._clip.value
  }

  isAtTargetPosition(otherClip: EditView.AnyTrackChild): boolean {
    const newPosition = this._newPosition.value
    if (!newPosition) return otherClip === this.clip

    return otherClip.parent?.id === newPosition.parentId && otherClip.index === newPosition.index
  }

  getAdjustedGap(otherClip: EditView.AnyTrackChild): Rational | undefined {
    if (!this.isDragging()) return

    const draggedClip = this.clip

    if (otherClip === draggedClip) return this._gapsAround.value[0]
    if (otherClip.prev === draggedClip) return this._gapsAround.value[1]

    const newPosition = this._newPosition.value

    if (
      newPosition &&
      otherClip.parent !== this.parent &&
      otherClip === getNodeAtTargetPosition(draggedClip.doc, newPosition)
    ) {
      return Rational.max(otherClip.original.gap, draggedClip.duration)
    }
  }

  start(clip: EditView.AnyTrackChild): void {
    if (!clip.parent) return
    const { parent } = clip

    this._newStart.value = clip.timeRational.start
    this._targetTrack.value = { id: parent.id, before: false }
    this._trackType.value = parent.trackType
    this._clipWasAloneInTrack.value = parent.head?.id === clip.id && parent.children.length === 1

    this._clip.value = clip
  }

  end(editor: pub.VideoEditor): void {
    if (!this.isDragging()) return

    const { clip, parent, newStart, targetTrack } = this
    const newPosition = this._newPosition.value
    this._clip.value = this._targetTrack.value = undefined

    editor._editor._transact(() => {
      if (targetTrack.before) {
        const beforeTrack = clip.doc.nodes.get<pub.Track>(targetTrack.id)
        const newTrack = clip.doc.createNode({
          id: editor.generateId(),
          type: 'track',
          trackType: parent.trackType,
        })

        const position = { parentId: newTrack.id, index: 0 }
        moveAndFillGaps(clip, position, newStart)
        newTrack.move({ parentId: beforeTrack.parent!.id, index: beforeTrack.index })
      } else
        moveAndFillGaps(clip.original, newPosition ?? { parentId: parent.id, index: clip.index }, newStart)
    })

    if (!parent.head) parent.delete()
  }
}

interface ClipDragContextIsDragging extends ClipDragContext {
  clip: NonNullable<ClipDragContext['clip']>
  parent: NonNullable<ClipDragContext['parent']>
  targetTrack: NonNullable<ClipDragContext['targetTrack']>
}
