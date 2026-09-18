import { expect, test } from 'vitest'

import { docWithTracks } from '#tests/test-content.ts'
import { tracksFromString } from '#tests/utils.ts'

import { Document } from '../../document.ts'

import { EditDocument } from './edit-document.ts'
import type { EditView } from './edit-nodes.ts'

test('clip resize context', () => {
  const doc = new Document({})
  doc.importFromJson({
    ...docWithTracks(
      tracksFromString(
        `
#  0         10        20
#  .123456789.123456789.123456789
v [ aaaaa     bbbbb ccccc]
a [  xx  yyyyy zzzzz]`,
        { rate: 1 },
      ),
    ),
    frameRate: 1,
  })

  const editDoc = new EditDocument(doc)
  const { clipResize } = editDoc
  const [clipA, clipB] = editDoc.timeline.children[0].children as EditView.AnyTrackChild[]
  const [clipX, clipY] = editDoc.timeline.children[1].children as EditView.AnyTrackChild[]

  expect(clipA.time.start).toBe(1)
  expect(clipA.gap.valueOf()).toBe(1)
  expect(clipB.time.start).toBe(11)
  expect(clipB.gap.valueOf()).toBe(5)

  expect(clipX.time.start).toBe(2)
  expect(clipY.time.start).toBe(6)
  expect(clipY.gap.valueOf()).toBe(2)

  // outer limit of start of first track and start of clip x's next sibling
  // inner limit based on duration of clip x (the shortest linked clip)
  doc.createLink({ id: 'link-1', nodes: [clipA, clipX] })

  clipResize.start(clipA)
  expect(clipResize.getOuterLimit()).toEqual({ start: 0, end: 8 })
  expect(clipResize.getInnerLimit()).toEqual({ start: 2, end: 5 })
  clipResize.end()

  clipResize.start(clipX)
  expect(clipResize.getOuterLimit()).toEqual({ start: 1, end: 6 })
  expect(clipResize.getInnerLimit()).toEqual({ start: 3, end: 3 })
  clipResize.end()
})
