import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { DocumentView } from '../src/document-views/document-view.ts'
import { NodeView } from '../src/document-views/node-view.ts'
import { Document } from '../src/document.ts'

import { makeClip, makeTrack } from './utils.ts'

class TestView extends NodeView<TestDocument, any> {
  _move = vi.fn()
  _update = vi.fn()
}

class TestDocument extends DocumentView<Record<string, TestView>> {
  _createView = vi.fn((original) => new TestView(this, original) as any)
  constructor(options: { doc: Document }) {
    super(options)
    this._init()
  }
}

let doc: Document
let testDoc: TestDocument

const clipInit = makeClip({ id: 'clip', clipType: 'audio', sourceRef: { assetId: 'unknown' } })
const trackInit = makeTrack('test-track', 'audio', [clipInit])

beforeEach(() => {
  doc = new Document({})
  doc.importFromJson({ resolution: { width: 1, height: 1 }, frameRate: 1, assets: [], tracks: [trackInit] })
  testDoc = new TestDocument({ doc })
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
