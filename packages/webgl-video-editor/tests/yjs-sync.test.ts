import { afterEach, beforeEach, expect, test } from 'vitest'
import * as Y from 'yjs'
import type { YTree } from 'yjs-orderedtree'

import { TIMELINE_ID } from '#constants'
import type { Schema } from '#core'
import type { VideoClip } from '#nodes'
import { initYjsRoot, YjsSync, YTREE_NULL_PARENT_KEY } from 'webgl-video-editor/yjs'

import { makeTrack, makeVideoClip } from './utils.ts'

let ydoc: Y.Doc
let sync: YjsSync
let ytree: YTree
let settings: Y.Map<any>

const clipInit = makeVideoClip({
  id: 'test-clip',
  clipType: 'video',
  name: 'test clip',
  mediaRef: { assetId: 'unknown' },
  duration: 1,
  transition: undefined,
})
const trackInit = makeTrack('test-track', 'video', [clipInit])

beforeEach(() => {
  ydoc = new Y.Doc()
  sync = new YjsSync(ydoc)
  ;({ ytree, settings } = initYjsRoot(ydoc))

  settings.set('resolution', { width: 1, height: 2 })
  settings.set('frameRate', 60)

  ytree.createNode(
    TIMELINE_ID,
    trackInit.id,
    new Y.Map(Object.entries(trackInit).filter(([key]) => key !== 'children')),
  )
  ytree.createNode(trackInit.id, clipInit.id, new Y.Map(Object.entries(clipInit)))
})

afterEach(() => {
  ydoc.destroy()
  sync.dispose()
})

test('creating a sync with empty YDoc initializes it', () => {
  // not using doc from beforeEach setup
  const ydoc = new Y.Doc()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- using
  using _sync = new YjsSync(ydoc)

  expect(ydoc.getMap('settings').toJSON()).toEqual({
    frameRate: 24,
    resolution: { height: 1080, width: 1920 },
  })
  expect([...ydoc.getMap('ytree').keys()].sort()).toEqual(['root', '_', 'timeline'].sort())

  ydoc.destroy()
})

test('populates document from Yjs data', () => {
  using sync = new YjsSync(ydoc)

  expect(sync.doc.toJSON()).toEqual({
    resolution: { width: 1, height: 2 },
    frameRate: 60,
    assets: [],
    tracks: [trackInit],
  } satisfies Schema.SerializedDocument)
})

test('syncs doc changes to Yjs doc', () => {
  sync.doc.resolution = { width: 50, height: 100 }
  const clip = sync.doc.nodes.get<VideoClip>(clipInit.id)

  clip.duration += 1

  const ynode = ytree.getNodeValueFromKey(clip.id) as Y.Map<any>
  expect(ynode.get('duration')).toBe(2)

  clip.delete()
  expect(ytree.getNodeParentFromKey(clip.id)).toBe(YTREE_NULL_PARENT_KEY)
})

test('disposes sync on YDoc destroy', () => {
  ydoc.destroy()
  expect(sync.isDisposed).toBe(true)
  expect(sync.doc.isDisposed).toBe(true)
})

test('disposes sync on doc dispose', () => {
  sync.doc.dispose()
  expect(sync.isDisposed).toBe(true)
  expect(ydoc.isDestroyed).toBe(false)
})

test(`disposing sync doesn't destroy YDoc`, () => {
  sync.dispose()

  expect(sync.isDisposed).toBe(true)
  expect(ydoc.isDestroyed).toBe(false)
})
