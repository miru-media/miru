import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { DocumentView } from '../src/document-views/document-view.ts'
import { NodeView } from '../src/document-views/node-view.ts'
import { Document } from '../src/document.ts'

import { docWithTracks } from './test-content.ts'
import { makeAudioClip, makeTrack } from './utils.ts'

class TestView extends NodeView<TestDocument, any> {
  _move = vi.fn()
  _update = vi.fn()
}

class TestDocument extends DocumentView<Record<string, TestView>> {
  _createView = vi.fn((original) => new TestView(this, original) as any)
  constructor(doc: Document) {
    super(doc)
    this._init()
  }
}

let doc: Document
let testDoc: TestDocument

const clipInit = makeAudioClip({ id: 'clip', mediaRef: { assetId: 'unknown' } })
const trackInit = makeTrack('test-track', 'audio', [clipInit])

beforeEach(() => {
  doc = new Document({})
  doc.importFromJson(docWithTracks([trackInit]))
  testDoc = new TestDocument(doc)
})

afterEach(() => {
  doc.dispose()
  testDoc.dispose()
})

test('recreates doc tree in view', () => {
  const testTrack = testDoc._getNode(doc.nodes.get(trackInit.id))
  const testClip = testDoc._getNode(doc.nodes.get(clipInit.id))

  expect(testClip._move).toHaveBeenLastCalledWith(testTrack, 0)
})

test('disposes view when doc is disposed', () => {
  process.stderr.write('\ndisposing doc\n')
  doc.dispose()
  process.stderr.write('\ndoc disposed\n')
  expect(testDoc.isDisposed).toBe(true)
})
