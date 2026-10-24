/* eslint-disable @typescript-eslint/no-unsafe-call -- missing YTree types in fix branch */
import { afterEach, beforeEach, expect, test } from 'vitest'
import * as Y from 'yjs'
import type { YTree } from 'yjs-orderedtree'

import { TIMELINE_ID } from '#constants'
import type { Schema } from '#core'
import type { VideoClip } from '#nodes'
import { Rational } from 'shared/utils/math.ts'
import { initYjsRoot, YjsSync } from 'webgl-video-editor/yjs'

import { EditDocument } from '../src/document-views/edit/edit-document.ts'

import { makeTimeline, makeVideoClip, makeVideoTrack } from './utils.ts'

let ydoc: Y.Doc
let sync: YjsSync
let ytree: YTree
let settings: Y.Map<any>

const clipInit = makeVideoClip({
  id: 'test-clip',
  name: 'test clip',
  mediaRef: { id: 'unknown', type: 'asset:media:av' },
  transition: undefined,
})
const trackInit = makeVideoTrack('test-track', [clipInit])

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
  expect([...ydoc.getMap('ytree').keys()].sort()).toEqual(['root', 'timeline'].sort())

  ydoc.destroy()
})

test('populates document from Yjs data', () => {
  using sync = new YjsSync(ydoc)

  expect(sync.doc.toJSON()).toEqual({
    resolution: { width: 1, height: 2 },
    frameRate: 60,
    assets: [],
    timeline: makeTimeline([trackInit]),
    links: [],
  } satisfies Schema.SerializedDocument)
})

test('syncs doc changes to Yjs doc', () => {
  sync.doc.resolution = { width: 50, height: 100 }
  const clip = sync.doc.nodes.get<VideoClip>(clipInit.id)

  clip.duration = clip.duration.add(new Rational(1, 1))

  const ynode = ytree.getNodeValueFromKey(clip.id) as Y.Map<any>
  expect(ynode.get('duration')).toEqual(new Rational(2, 1).toJSON())

  clip.delete()
  expect(() => ytree.getNodeParentFromKey(clip.id)).toThrow()
})

test('syncs node keyframe changes', () => {
  const ydoc2 = new Y.Doc()
  Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(sync.ydoc))
  const yjsRoot2 = initYjsRoot(ydoc2)
  const sync2 = new YjsSync(yjsRoot2.ydoc)

  sync.doc.resolution = { width: 50, height: 100 }
  const editDoc = new EditDocument(sync.doc)
  const editClip = editDoc.nodes.get<VideoClip>(clipInit.id)

  editClip._toggleKeyframesAt(['rotate', 'translateX'], Rational.ZERO)

  Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(sync.ydoc))

  const sync2Ynode = yjsRoot2.ytree.getNodeValueFromKey(editClip.id) as Y.Map<any>

  expect(sync2Ynode.get('animations').toJSON()).toEqual({
    rotate: {
      keyframes: [{ value: 0, dt: { value: 0, rate: 1 }, easing: 'linear' }],
    },
    translateX: {
      keyframes: [{ value: 0, dt: { value: 0, rate: 1 }, easing: 'linear' }],
    },
  } satisfies Schema.Base['animations'])

  Y.applyUpdate(sync2.ydoc, Y.encodeStateAsUpdate(sync.ydoc))
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
