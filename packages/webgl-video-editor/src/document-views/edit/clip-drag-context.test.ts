import { expect, test } from 'vitest'

import { Rational } from 'shared/utils'

import { docWithTracks } from '../../../tests/test-content.ts'
import { makeTrack, makeVideoClip } from '../../../tests/utils.ts'
import { Document } from '../../document.ts'

import { EditDocument } from './edit-document.ts'
import type { EditView } from './edit-nodes.ts'

test('x', () => {
  const doc = new Document({})
  doc.importFromJson(
    docWithTracks([
      makeTrack('track-0', 'video', [
        makeVideoClip({ id: 'clip-0', duration: { value: 5, rate: 1 } }),
        makeVideoClip({ id: 'clip-1', duration: { value: 5, rate: 1 }, gap: { value: 5, rate: 1 } }),
        makeVideoClip({ id: 'clip-2', duration: { value: 5, rate: 1 }, gap: { value: 1, rate: 1 } }),
      ]),
      makeTrack('track-1', 'video', [
        makeVideoClip({ id: 'clip-a', duration: { value: 5, rate: 1 } }),
        makeVideoClip({ id: 'clip-b', duration: { value: 5, rate: 1 }, gap: { value: 5, rate: 1 } }),
        makeVideoClip({ id: 'clip-c', duration: { value: 5, rate: 1 }, gap: { value: 1, rate: 1 } }),
      ]),
    ]),
  )

  const editDoc = new EditDocument(doc)
  const { clipDrag } = editDoc
  const [clip0, clip1] = editDoc.timeline.head!.children as EditView.AnyTrackChild[]

  clipDrag.start(clip0)

  expect(clip0.time.start).toBe(0)
  expect(clip0.gap.valueOf()).toBe(0)
  expect(clip1.gap.valueOf()).toBe(5)
  expect(clip1.time.start).toBe(10)
  expect(clipDrag._newPosition.value).toBeUndefined()

  clipDrag.newStart = new Rational(1, 2)
  expect(clip0.gap.valueOf()).toBe(0.5)
  expect(clip0.time.start).toBe(0.5)
  expect(clip1.gap.valueOf()).toBe(4.5)
  expect(clip1.time.start).toBe(10)
  expect(clipDrag._newPosition.value).toBeUndefined()

  expect(clip0.original.time.start).toBe(0)
  expect(clip1.original.time.start).toBe(10)

  // appears to overlap with next clip while dragging
  clipDrag.newStart = new Rational(6, 1)
  expect(clip0.gap.valueOf()).toBe(6)
  expect(clip1.gap.valueOf()).toBe(-1)
  expect(clip1.time.start).toBe(10)
  expect(clipDrag._newPosition.value).toBeUndefined()

  // calculates new position on same track
  clipDrag.newStart = new Rational(10, 1)
  expect(clipDrag._newPosition.value).toEqual({ parentId: clip0.parent?.id, index: 2 })
})
