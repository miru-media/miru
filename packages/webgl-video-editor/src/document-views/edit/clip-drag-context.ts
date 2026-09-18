import { computed, ref, type Ref } from 'fine-jsx'

import type * as pub from '#core'
import { Rational } from 'shared/utils/math.ts'

import { moveAndFillGaps, nodesAreLinked } from '../../components/utils.ts'

import type { EditView } from './edit-nodes.ts'

type TargetTrack = { id: string; before: boolean } | { id: string | undefined; before: true }

interface LinkedResult {
  positions: Record<
    string,
    pub.ChildNodePosition & { nextId: string | undefined; isSameParentLowerIndex: boolean }
  >
  startDelta: Rational
  nextGapDelta: Rational
  nextClipIds: Set<string>
}

const FIXED_AV_PAIRS = true as boolean

export class ClipDragContext {
  _clip = ref<EditView.AnyTrackChild>()
  _linkedClips = computed(() => {
    const clip = this.clip?.original
    if (!clip) return []

    const linkedNodes = clip.link?.nodes
    if (!linkedNodes) return [clip]

    const clips = linkedNodes.map(({ id }) => clip.doc.nodes.get<EditView.AnyClip>(id))
    const trackCount = clip.doc.timeline.count

    const getParentTrackIndex = (clip: pub.AnyClip): number => {
      const track = clip.parent
      // sort audio tracks after video
      return track ? track.index + (track.isAudio() ? trackCount : 0) : -1
    }
    return clips.sort((a, b) => getParentTrackIndex(a) - getParentTrackIndex(b))
  })
  _maxLinkedDuration = computed(() =>
    this._linkedClips.value.reduce((acc, clip) => Rational.max(acc, clip.duration), Rational.ZERO),
  )
  _newStart = ref(Rational.ZERO)
  _offsetY = ref(0)
  _targetTrack = ref<TargetTrack>()
  _clipWasAloneInTrack = computed(() => {
    const { clip } = this
    const parent = clip?.parent
    return !!parent && parent.head?.id === clip.id && parent.children.length === 1
  })
  _adjustGapsAroundLinkedClips = computed((): Partial<Record<string, [Rational, Rational]>> => {
    if (!this.isActive()) return {}

    const result: Record<string, [Rational, Rational]> = {}
    const { startDelta } = this._linkedResult.value

    this.linkedClips.forEach((clip) => {
      const { prev, next } = clip
      const newStart = clip.timeRational.start.add(startDelta)
      const prevClipEnd = prev?.timeRational.end ?? Rational.ZERO
      const startGap = newStart.subtract(prevClipEnd)

      let endGap

      if (next) {
        const deltaGap = clip.gap.subtract(startGap)
        endGap = next.gap.add(deltaGap)
      } else endGap = Rational.ZERO

      result[clip.id] = [startGap, endGap]
    })

    return result
  })
  _newPosition = computed((): pub.ChildNodePosition | undefined => {
    if (!this.isActive()) return

    const { clip, targetTrack, newStart } = this

    if (targetTrack.before) return

    const duration = clip.duration.valueOf()
    const newStartTime = newStart.valueOf()
    const newCenterTime = newStartTime + duration / 2
    const track = clip.docView._getNode(clip.doc.nodes.get<pub.AnyTrack>(targetTrack.id))

    let insertBefore: EditView.AnyTrackChild | undefined
    const toSameParent = track.id === this.parent.id
    const searchStartingNode = toSameParent ? clip : track.head

    if (!searchStartingNode) return { parentId: track.id, index: 0 }

    if (!toSameParent) {
      const index = (track.children as EditView.AnyTrackChild[]).findIndex((node) => {
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
  _linkedResult = computed((): LinkedResult | undefined => {
    if (!this.isActive()) return

    const dragClip = this.clip.original
    const newDragPosition = this._newPosition.value ?? { parentId: this.parent.id, index: dragClip.index }
    const resolvedDragParent = dragClip.doc.nodes.get<pub.AnyTrack>(newDragPosition.parentId)
    const startDelta = this.newStart.subtract(dragClip.timeRational.start)
    const positions: LinkedResult['positions'] = {}
    let maxOverlapWithPrevClip = Rational.ZERO
    let maxOverlapWithNextClip = Rational.ZERO
    const nextClipIds = new Set<string>()

    this.linkedClips.forEach((clip) => {
      const newStart = clip.timeRational.start.add(startDelta)
      let resolvedParent
      let insertBefore

      if (clip.id === dragClip.id) {
        resolvedParent = resolvedDragParent
        insertBefore = resolvedDragParent.children[newDragPosition.index]
      } else if (FIXED_AV_PAIRS) {
        resolvedParent = clip.parent!
        insertBefore = resolvedParent.children[newDragPosition.index]
      } else {
        // TODO: handle links of more than 2 clips and tracks better
        const resolvedParentId = (
          resolvedDragParent.link?.nodes.find(
            (trackLinkItem) =>
              trackLinkItem.id !== resolvedDragParent.id && trackLinkItem.type === clip.parent!.type,
          ) ?? clip.parent
        )?.id
        resolvedParent = resolvedParentId ? dragClip.doc.nodes.get<pub.AnyTrack>(resolvedParentId) : undefined
        if (!resolvedParent) return

        for (insertBefore = resolvedParent.head; insertBefore; { next: insertBefore } = insertBefore) {
          if (insertBefore.timeRational.start.isGte(newStart)) break
        }
      }

      const isSamePosition = insertBefore?.id === clip.id || insertBefore?.prev?.id === clip.id
      const prev = isSamePosition ? clip.prev : insertBefore?.prev
      const next = isSamePosition ? clip.next : insertBefore
      const newIndex = isSamePosition
        ? clip.index
        : (insertBefore?.index ?? resolvedParent.count - (resolvedParent.id === clip.parent?.id ? 1 : 0))

      positions[clip.id] = {
        parentId: resolvedParent.id,
        index: newIndex,
        nextId: next?.id,
        isSameParentLowerIndex: resolvedParent.id === clip.parent?.id && newIndex < clip.index,
      }

      maxOverlapWithPrevClip = Rational.max(
        Rational.max((prev?.timeRational.end ?? Rational.ZERO).subtract(newStart), newStart.negate()),
        maxOverlapWithPrevClip,
      )
      if (next) {
        maxOverlapWithNextClip = Rational.max(
          newStart.add(clip.duration).subtract(next.timeRational.start),
          maxOverlapWithNextClip,
        )
        nextClipIds.add(next.id)
      }
    })

    return {
      positions,
      startDelta: startDelta.add(maxOverlapWithPrevClip),
      nextGapDelta: maxOverlapWithNextClip,
      nextClipIds,
    }
  })

  get clip(): EditView.AnyTrackChild | undefined {
    return this._clip.value
  }
  get linkedClips(): pub.AnyClip[] {
    return this._linkedClips.value
  }
  get parent(): pub.AnyTrackChild['parent'] {
    return this._clip.value?.original.parent
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

  isActive(): this is ClipDragContextIsDragging {
    return !!this._clip.value
  }

  isValidTarget(track: pub.AnyTrack | undefined, before: boolean): track is NonNullable<typeof track> {
    return (
      !!track &&
      (before || this.clip?.isVideo() === track.isVideo()) &&
      // TODO: improve for more than 2 linked clips
      // if dragged clip is linked, only allow dragging into a track with a link
      // don't allow dragging unlinked clips into tracks with links
      this.linkedClips.length > 1 === !!track.link
    )
  }

  isDraggedOrLinked(clip: EditView.AnyTrackChild | undefined): boolean {
    return !!clip && this.isActive() && nodesAreLinked(clip, this.clip)
  }

  getAdjustedGap(clip: EditView.AnyTrackChild): Rational | undefined {
    if (!this.isActive()) return

    const linkedGapsAround = this._adjustGapsAroundLinkedClips.value

    const gapsAround = linkedGapsAround[clip.id]
    if (gapsAround) {
      return gapsAround[0].subtract(
        this._linkedResult.value.positions[clip.id].isSameParentLowerIndex
          ? this._linkedResult.value.nextGapDelta
          : Rational.ZERO,
      )
    }

    const { nextGapDelta, nextClipIds } = this._linkedResult.value

    const gapsAroundPrev = clip.prev && linkedGapsAround[clip.prev.id]

    if (gapsAroundPrev) return gapsAroundPrev[1].add(nextClipIds.has(clip.id) ? nextGapDelta : Rational.ZERO)

    if (nextClipIds.has(clip.id)) return clip.original.gap.add(nextGapDelta)
  }

  start(clip: EditView.AnyTrackChild): boolean {
    const { parent, link } = clip
    // TODO: handle links of more than 2 clips
    if (!parent || (link && link.nodes.length > 2)) return false

    this._newStart.value = clip.timeRational.start
    this._offsetY.value = 0
    this._targetTrack.value = { id: parent.id, before: false }

    this._clip.value = clip
    return true
  }

  end(editor: pub.VideoEditor): void {
    if (!this.isActive()) return

    // use clip without modified gaps for showing drag position
    const dragClip = this.clip.original
    const { linkedClips, parent: prevParent, targetTrack } = this
    const { positions, startDelta, nextGapDelta } = this._linkedResult.value
    const { doc } = dragClip

    editor._editor._transact(() => {
      if (targetTrack.before) {
        const beforeTrack = targetTrack.id ? doc.nodes.get<pub.AnyTrack>(targetTrack.id) : undefined
        const newLinkedTracks: pub.AnyTrack[] = []

        linkedClips.forEach((clip) => {
          const newTrack = doc.createNode({
            id: editor.generateId(),
            type: clip.parent!.type,
          })

          const position = { parentId: newTrack.id, index: 0 }
          moveAndFillGaps(clip, position, clip.timeRational.start.add(startDelta), nextGapDelta)
          newTrack.move(
            beforeTrack
              ? { parentId: beforeTrack.parent!.id, index: beforeTrack.index }
              : { parentId: doc.timeline.id, index: doc.timeline.count },
          )
          newLinkedTracks.push(newTrack)
        })

        if (newLinkedTracks.length > 1) doc.createLink({ id: editor.generateId(), nodes: newLinkedTracks })
      } else {
        linkedClips.forEach((clip) => {
          moveAndFillGaps(clip, positions[clip.id], clip.timeRational.start.add(startDelta), nextGapDelta)
        })
      }

      const editViewTrack = editor._editor.doc._getNode(prevParent)
      const linkedParents = editViewTrack.link?.nodes ?? [editViewTrack]
      if (linkedParents.every(({ count }) => count === 0)) linkedParents.forEach((node) => node.delete())
    })

    this.cancel()
  }

  cancel(): void {
    this._clip.value = this._targetTrack.value = undefined
  }
}

interface ClipDragContextIsDragging extends ClipDragContext {
  clip: NonNullable<ClipDragContext['clip']>
  parent: NonNullable<ClipDragContext['parent']>
  targetTrack: NonNullable<ClipDragContext['targetTrack']>
  _linkedResult: Ref<LinkedResult>
}
