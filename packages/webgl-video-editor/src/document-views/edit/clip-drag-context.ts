import { computed, ref } from 'fine-jsx'

import type * as pub from '#core'
import { Rational } from 'shared/utils/math.ts'

import { getNodeAtTargetPosition, moveAndFillGaps, nodesAreLinked } from '../../components/utils.ts'

import type { EditView } from './edit-nodes.ts'

interface TargetTrack {
  id: string
  before: boolean
}

export class ClipDragContext {
  _clip = ref<EditView.AnyTrackChild>()
  _linkedClips = ref<EditView.AnyClip[]>([])
  _newStart = ref(Rational.ZERO)
  _offsetY = ref(0)
  _targetTrack = ref<TargetTrack>()
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
    const track = clip.docView._getNode(clip.doc.nodes.get<pub.AnyTrack>(targetTrack.id))

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
  get linkedClips(): EditView.AnyTrackChild[] {
    return this._linkedClips.value
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
  get targetTrack(): TargetTrack | undefined {
    return this._targetTrack.value
  }
  set targetTrack(value) {
    this._targetTrack.value = value
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

  isValidTarget(track: pub.AnyTrack | undefined): boolean {
    return (
      !!track &&
      this.clip?.isVideo() === track.isVideo() &&
      // TODO: improve for more than 2 linked clips
      // if dragged clip is linked, only allow dragging into a track with a link
      // don't allow dragging unlinked clips into tracks with links
      this.linkedClips.length > 1 === !!track.link
    )
  }

  isDraggedOrLinked(clip: EditView.AnyTrackChild | undefined): boolean {
    return !!clip && this.isDragging() && nodesAreLinked(clip, this.clip)
  }

  getAdjustedGap(clip: EditView.AnyTrackChild): Rational | undefined {
    if (!this.isDragging()) return

    const draggedClip = this.clip

    if (this.isDraggedOrLinked(clip)) return this._gapsAround.value[0]
    if (this.isDraggedOrLinked(clip.prev)) return this._gapsAround.value[1]

    const newPosition = this._newPosition.value

    if (
      newPosition &&
      clip.parent !== this.parent &&
      clip === getNodeAtTargetPosition(draggedClip.doc, newPosition)
    ) {
      return Rational.max(clip.original.gap, draggedClip.duration)
    }
  }

  start(clip: EditView.AnyTrackChild): void {
    if (!clip.parent) return
    const { parent } = clip

    this._newStart.value = clip.timeRational.start
    this._offsetY.value = 0
    this._targetTrack.value = { id: parent.id, before: false }
    this._clipWasAloneInTrack.value = parent.head?.id === clip.id && parent.children.length === 1

    this._clip.value = clip
    this._linkedClips.value = clip.link?.nodes ?? [clip]
  }

  end(editor: pub.VideoEditor): void {
    if (!this.isDragging()) return

    const { clip: dragClip, linkedClips, parent: prevParent, newStart, targetTrack } = this
    const { doc } = dragClip
    const newPosition = this._newPosition.value
    this._clip.value = this._targetTrack.value = undefined
    this._linkedClips.value = []

    editor._editor._transact(() => {
      if (targetTrack.before) {
        const beforeTrack = doc.nodes.get<pub.AnyTrack>(targetTrack.id)
        const newLinkedTracks: pub.AnyTrack[] = []

        linkedClips.forEach((clip) => {
          const newTrack = clip.doc.createNode({
            id: editor.generateId(),
            type: clip.parent!.type,
          })

          const position = { parentId: newTrack.id, index: 0 }
          moveAndFillGaps(clip, position, newStart)
          newTrack.move({ parentId: beforeTrack.parent!.id, index: beforeTrack.index })
          newLinkedTracks.push(newTrack)
        })

        if (newLinkedTracks.length > 1) doc.createLink({ id: editor.generateId(), nodes: newLinkedTracks })
      } else {
        // clip without modified gaps for showing drag position
        const originalDragClip = dragClip.original
        const finalDragClipPosition = newPosition ?? { parentId: prevParent.id, index: dragClip.index }
        const finalParent = originalDragClip.doc.nodes.get<pub.AnyTrack>(finalDragClipPosition.parentId)

        linkedClips.forEach((clip) => {
          const linkedPosition =
            clip.id === dragClip.id
              ? finalDragClipPosition
              : // TODO: handle more than 2 clips and tracks better
                {
                  parentId:
                    finalParent.link?.nodes.find(
                      (trackLinkItem) =>
                        trackLinkItem.id !== finalParent.id && trackLinkItem.type === clip.parent!.type,
                    )?.id ?? clip.parent!.id,
                  index: finalDragClipPosition.index,
                }

          moveAndFillGaps(clip.original, linkedPosition, newStart)
        })
      }

      const editViewTrack = editor._editor.doc._getNode(prevParent)
      const linkedParents = editViewTrack.link?.nodes ?? [editViewTrack]
      if (linkedParents.every(({ count }) => count === 0)) linkedParents.forEach((node) => node.delete())
    })
  }
}

interface ClipDragContextIsDragging extends ClipDragContext {
  clip: NonNullable<ClipDragContext['clip']>
  parent: NonNullable<ClipDragContext['parent']>
  targetTrack: NonNullable<ClipDragContext['targetTrack']>
}
