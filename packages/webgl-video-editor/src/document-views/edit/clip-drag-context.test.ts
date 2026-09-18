import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { docWithTracks } from '#tests/test-content.ts'
import { tracksFromString } from '#tests/utils.ts'
import { Rational } from 'shared/utils'

import { Document } from '../../document.ts'

import type { ClipDragContext } from './clip-drag-context.ts'
import { EditDocument } from './edit-document.ts'
import type { EditView } from './edit-nodes.ts'

let doc!: Document
let editDoc!: EditDocument
let clipDrag!: ClipDragContext
let clipA!: EditView.AnyTrackChild
let clipB!: EditView.AnyTrackChild
let clipC!: EditView.AnyTrackChild
let clipX!: EditView.AnyTrackChild
let clipY!: EditView.AnyTrackChild
let clipZ!: EditView.AnyTrackChild

beforeEach(() => {
  doc = new Document({})
  doc.importFromJson(
    docWithTracks([
      ...tracksFromString(
        `
#  0         10        20
#  .123456789.123456789.123456789
v [aaaaa     bbbbb ccccc]
v [  x       yyyy  zzzzz]`,
        { rate: 1 },
      ),
    ]),
  )

  editDoc = new EditDocument(doc)
  ;({ clipDrag } = editDoc)
  ;[clipA, clipB, clipC] = editDoc.timeline.head!.children as EditView.AnyTrackChild[]
  ;[clipX, clipY, clipZ] = editDoc.timeline.tail!.children as EditView.AnyTrackChild[]
  doc.createLink({ id: 'link-1', nodes: [clipA, clipX] })
  doc.createLink({ id: 'link-2', nodes: [clipB, clipZ] })
  doc.createLink({ id: 'link-3', nodes: [clipC, clipY] })
})

afterEach(() => doc.dispose())

describe('clip drag context', () => {
  test(`clips and its links move when space is available`, () => {
    clipDrag.start(clipA)

    expect(clipA.time.start).toBe(0)
    expect(clipA.gap.valueOf()).toBe(0)
    expect(clipB.gap.valueOf()).toBe(5)
    expect(clipB.time.start).toBe(10)
    expect(clipDrag._newPosition.value).toBeUndefined()

    clipDrag.newStart = new Rational(1, 1)
    expect(clipA.gap.valueOf()).toBe(1)
    expect(clipA.time.start).toBe(1)
    expect(clipB.gap.valueOf()).toBe(4)
    expect(clipB.time.start).toBe(10)
    expect(clipDrag._newPosition.value).toBeUndefined()

    expect(clipA.original.time.start).toBe(0)
    expect(clipB.original.time.start).toBe(10)

    // moves linked clip
    expect(clipX.time.start).toBe(3)
    expect(clipY.time.start).toBe(10)
  })

  test(`clip or its links can't be dragged to start before 0`, () => {
    clipDrag.start(clipX)
    clipDrag.newStart = new Rational(-1, 1)
    expect(clipA.time.start).toBe(0)
    expect(clipA.time.end).toBe(5)
    expect(clipX.time.start).toBe(2)
    expect(clipX.time.end).toBe(3)
    clipDrag.cancel()
  })

  test.each(['a', 'x'])(
    `clip %s or its links can't be dragged to overlap with the end of another clip`,
    (id) => {
      clipDrag.start(editDoc.nodes.get<EditView.AnyClip>(id))
      clipDrag.newStart = new Rational(-1, 1)
      expect(clipA.time.start).toBe(0)
      expect(clipA.time.end).toBe(5)
      expect(clipX.time.start).toBe(2)
      expect(clipX.time.end).toBe(3)
      clipDrag.cancel()
    },
  )

  test(`pushes next clip and its links forward instead of overlapping`, () => {
    clipDrag.start(clipA)
    expect(clipZ.time.start).toBe(16)
    clipDrag.newStart = new Rational(6, 1)

    expect(clipA.time.start).toBe(6)
    expect(clipB.gap.valueOf()).toBe(0)
    expect(clipB.time.start).toBe(11)

    // TODO: improve linking
    // clip y doesn't move because there's enough space from clip x
    // expect(clipY.time.start).toBe(10)

    // clip z moves as it's linked to a clip b that was pushed forward
    expect(clipZ.time.start).toBe(17)
    expect(clipDrag._newPosition.value).toBeUndefined()
  })

  test(`calculates new position on same track`, () => {
    clipDrag.start(clipA)
    clipDrag.newStart = new Rational(10, 1)
    expect(clipDrag._newPosition.value).toEqual({ parentId: clipA.parent?.id, index: 2 })
  })
})
