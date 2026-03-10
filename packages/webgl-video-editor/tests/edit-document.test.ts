import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type * as pub from '#core'

import { DocumentView } from '../src/document-views/document-view.ts'
import { EditDocument } from '../src/document-views/edit/edit-document.ts'
import type { EditView } from '../src/document-views/edit/edit-nodes.ts'
import { NodeView } from '../src/document-views/node-view.ts'
import { Document } from '../src/document.ts'
import * as events from '../src/events.ts'

import { makeClip, makeTrack } from './utils.ts'

class TestView extends NodeView<TestDocument, any> {
  _move = vi.fn()
  _update = vi.fn()
}

class TestDocument extends DocumentView<Record<string, TestView>> {
  _createView = vi.fn((original) => new TestView(this, original) as any)
  constructor(doc: pub.Document) {
    super(doc)
    this._init()
  }
}

let doc: Document
let editDoc: EditDocument
let testDoc: TestDocument

let editClip1: EditView<pub.AudioClip> & pub.AudioClip
let editClip2: EditView<pub.VisualClip> & pub.VisualClip
let originalClip1: pub.AudioClip
let originalClip2: pub.VisualClip

const clipInit1 = makeClip({ id: 'clip-1', clipType: 'audio', sourceRef: { assetId: 'unknown' } })
const clipInit2 = makeClip({ id: 'clip-2', clipType: 'video', sourceRef: { assetId: 'unknown' } })
const clipInit3 = makeClip({ id: 'clip-3', clipType: 'video', sourceRef: { assetId: 'unknown' } })
const trackInit = makeTrack('test-track', 'audio', [clipInit1, clipInit2])

const onDocUpdate = vi.fn()
const onEditDocUpdate = vi.fn()
const viewMarkerMatcher = expect.objectContaining({ _is_edit_view: true })

beforeEach(() => {
  doc = new Document({})
  doc.on('node:update', onDocUpdate)
  doc.importFromJson({ resolution: { width: 1, height: 1 }, frameRate: 1, assets: [], tracks: [trackInit] })

  editDoc = new EditDocument(doc)
  testDoc = new TestDocument(editDoc)
  editDoc.on('node:update', onEditDocUpdate)

  editClip1 = editDoc.nodes.get(clipInit1.id)
  editClip2 = editDoc.nodes.get(clipInit2.id)
  originalClip1 = doc.nodes.get(clipInit1.id)
  originalClip2 = doc.nodes.get(clipInit2.id)

  onDocUpdate.mockClear()
  onEditDocUpdate.mockClear()
})

afterEach(() => {
  doc.dispose()
  editDoc.dispose()
  testDoc.dispose()
  onDocUpdate.mockClear()
  onEditDocUpdate.mockClear()
})

test('gets proxied nodes', () => {
  expect(editClip1._is_edit_view).toBe(true)
  expect(editClip2._is_edit_view).toBe(true)
  expect(editDoc.timeline._is_edit_view).toBe(true)
})

test('re-emits events from original doc with proxied nodes', () => {
  const listener = vi.fn()
  editDoc.on('node:create', listener)
  editDoc.on('node:update', listener)
  editDoc.on('node:delete', listener)

  editDoc.on('asset:create', listener)
  editDoc.on('canvas:pointerup', listener)
  editDoc.on('playback:seek', listener)

  const originalClip3 = doc.createNode(clipInit3)
  originalClip3.duration += 1
  originalClip3.delete()

  doc.emit(new events.AssetCreateEvent({} as any))
  doc.emit(new events.CanvasEvent('pointerup', originalClip2))
  doc.emit(new events.PlaybackSeekEvent())

  expect(listener).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ type: 'node:create', node: viewMarkerMatcher }),
  )
  expect(listener).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ type: 'node:update', node: viewMarkerMatcher, key: 'duration', from: 1 }),
  )
  expect(listener).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({ type: 'node:delete', node: viewMarkerMatcher }),
  )
  expect(listener).toHaveBeenNthCalledWith(4, expect.objectContaining({ type: 'asset:create' }))
  expect(listener).toHaveBeenNthCalledWith(
    5,
    expect.objectContaining({ type: 'canvas:pointerup', node: viewMarkerMatcher }),
  )
  expect(listener).toHaveBeenNthCalledWith(6, expect.objectContaining({ type: 'playback:seek' }))
})

test('views on top of the edit document see the proxied nodes', () => {
  expect(testDoc._createView).toHaveBeenNthCalledWith(1, viewMarkerMatcher)
  expect(testDoc._createView).toHaveBeenNthCalledWith(2, viewMarkerMatcher)
  expect(testDoc._createView).toHaveBeenNthCalledWith(3, viewMarkerMatcher)
  expect(testDoc._createView).toHaveBeenNthCalledWith(4, viewMarkerMatcher)
  expect(testDoc._createView).toHaveBeenCalledTimes(4)
})

test('while editing, update events to original node are suppressed', () => {
  const editListener = vi.fn()
  editDoc.on('node:update', editListener)

  editClip1._startEditing(['duration'])
  originalClip1.duration += 1
  expect(editListener).not.toHaveBeenCalled()
  expect(editClip1.duration).toBe(1)
})

test('while editing, changes appear only on proxies', () => {
  editClip1._startEditing(['duration', 'name'])

  editClip1.duration += 1
  editClip1.name = 'new name'

  expect(onDocUpdate).not.toHaveBeenCalled()
  expect(onEditDocUpdate).toHaveBeenCalled()

  editClip2.duration += 10

  expect(originalClip1).toMatchObject({ duration: 1, name: undefined })
  expect(editClip1.toObject()).toEqual({ ...clipInit1, duration: 2, name: 'new name' })

  expect(originalClip2.toObject()).toEqual({ ...clipInit2, duration: 11 })
  expect(editClip2.toObject()).toEqual({ ...clipInit2, duration: 11 })

  expect(originalClip2.time).toEqual({ start: 1, source: 0, end: 12, duration: 11 })
  expect(editClip2.time).toEqual({ start: 2, source: 0, end: 13, duration: 11 })

  expect(originalClip2.presentationTime).toEqual({ start: 1, source: 0, end: 12, duration: 11 })
  expect(editClip2.presentationTime).toEqual({ start: 2, source: 0, end: 13, duration: 11 })
})

test('applying edits updates original doc', () => {
  editClip1._startEditing(['duration', 'name'])

  editClip1.duration += 1
  editClip1.name = 'new name'

  editClip2.duration += 10

  editClip1._applyEdits()

  expect(originalClip1).toMatchObject({ duration: 2, name: 'new name' })
  expect(editClip1.toObject()).toMatchObject({ duration: 2, name: 'new name' })

  expect(onDocUpdate).toHaveBeenCalledWith(expect.objectContaining({ key: 'duration', from: 1 }))

  expect(originalClip2).toMatchObject({ duration: 11, name: undefined })
})

test('dropping edits clears changes without updating original', () => {
  editClip1._startEditing(['duration', 'name'])

  editClip1.duration += 1
  editClip1.name = 'new name'
  editClip2.duration += 10

  editClip1._dropEdits()

  expect(originalClip1.toObject()).toEqual(clipInit1)
  expect(editClip1.toObject()).toEqual(clipInit1)

  expect(originalClip2).toMatchObject({ duration: 11, name: undefined })
  expect(editClip2.toObject()).toMatchObject({ duration: 11, name: undefined })
})

test('deferred update events from original node are fired when dropping edits', () => {
  editClip1._startEditing(['name'])
  originalClip1.name = 'name on original'

  expect(onEditDocUpdate).not.toHaveBeenCalled()

  editClip1.name = 'name on edit'
  expect(onEditDocUpdate).toHaveBeenCalled()

  editClip1.duration = 10

  onEditDocUpdate.mockClear()
  editClip1._dropEdits()

  expect(onEditDocUpdate).toHaveBeenCalledWith(expect.objectContaining({ key: 'name', from: 'name on edit' }))
  expect(editClip1.name).toBe('name on original')
})
