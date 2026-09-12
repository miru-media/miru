import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type * as pub from '#core'

import { Document } from '../src/document.ts'
import * as events from '../src/events.ts'

import { docWithTracks } from './test-content.ts'
import { makeAudioClip, makeAudioTrack, makeLink, makeVideoClip, makeVideoTrack } from './utils.ts'

let stack: DisposableStack
let doc: Document

let trackPair1Video: pub.VideoTrack
let trackPair1Audio: pub.AudioTrack
let track3: pub.VideoTrack
let clipPair1Video: pub.VideoClip
let clipPair1Audio: pub.AudioClip
let clip3: pub.VideoClip

const clipPair1VideoInit = makeAudioClip({ id: 'clip-pair-video' })
const clipPair1AudioInit = makeAudioClip({ id: 'clip-pair-audio' })
const clip3Init = makeVideoClip({ id: 'clip-3' })

const trackPair1VideoInit = makeAudioTrack('track-pair-video', [clipPair1VideoInit])
const trackPair1AudioInit = makeAudioTrack('track-pair-audio', [clipPair1AudioInit])
const track3Init = makeVideoTrack('track-3', [clip3Init])

const onLinkCreate = vi.fn()
const onLinkUpdate = vi.fn()
const onLinkDelete = vi.fn()

const trackLinkInit = makeLink('link-tracks-1', [trackPair1VideoInit, trackPair1AudioInit])
const clipLinkInit = makeLink('link-clips-1', [clipPair1VideoInit, clipPair1AudioInit])

const clearMockListeners = () => [onLinkCreate, onLinkUpdate, onLinkDelete].forEach((fn) => fn.mockClear())

beforeEach(() => {
  stack = new DisposableStack()
  doc = stack.use(new Document({}))
  doc.on('link:create', onLinkCreate)
  doc.on('link:update', onLinkUpdate)
  doc.on('link:delete', onLinkDelete)
  doc.importFromJson({
    ...docWithTracks([trackPair1VideoInit, trackPair1AudioInit, track3Init]),
    links: [trackLinkInit, clipLinkInit],
  })

  trackPair1Video = doc.nodes.get(trackPair1VideoInit.id)
  trackPair1Audio = doc.nodes.get(trackPair1AudioInit.id)
  track3 = doc.nodes.get(track3Init.id)
  clipPair1Video = doc.nodes.get(clipPair1VideoInit.id)
  clipPair1Audio = doc.nodes.get(clipPair1AudioInit.id)
  clip3 = doc.nodes.get(clip3Init.id)

  clearMockListeners()
})

afterEach(() => {
  stack.dispose()
  clearMockListeners()
})

test('{clip,track}.link resolve to link item', () => {
  expect(trackPair1Video.link).toEqual(trackLinkInit)
  expect(trackPair1Audio.link).toEqual(trackLinkInit)
  expect(track3.link).toBeUndefined()

  expect(clipPair1Video.link).toEqual(clipLinkInit)
  expect(clipPair1Audio.link).toEqual(clipLinkInit)
  expect(clip3.link).toBeUndefined()
})

test('doc.links.get(), doc.{create,update,delete}Link()', () => {
  // Read
  expect(doc.links.get(trackLinkInit.id)).toEqual(trackLinkInit)
  expect(doc.links.get(clipLinkInit.id)).toEqual(clipLinkInit)

  // Delete
  doc.deleteLink(trackLinkInit.id)
  expect(onLinkDelete).toHaveBeenNthCalledWith(1, expect.any(events.LinkDeleteEvent))
  expect(trackPair1Video.link ?? trackPair1Audio.link).toBeUndefined()
  expect(doc.links.get(trackLinkInit.id)).toBeUndefined()

  // Create
  const newLinkInit = makeLink('new-track-link', [trackPair1VideoInit, track3Init])
  doc.createLink(newLinkInit)
  expect(onLinkCreate).toHaveBeenNthCalledWith(1, expect.any(events.LinkCreateEvent))
  expect(trackPair1Video.link).toEqual(newLinkInit)
  expect(doc.links.get(newLinkInit.id)).toEqual(newLinkInit)

  // Update
  doc.updateLink(newLinkInit.id, [...newLinkInit.nodes, trackPair1AudioInit])
  expect(onLinkUpdate).toHaveBeenNthCalledWith(1, expect.any(events.LinkUpdateEvent))
  expect(trackPair1Video.link).toEqual(
    makeLink('new-track-link', [trackPair1VideoInit, track3Init, trackPair1AudioInit]),
  )
})

test('deletes link when deleting any of its nodes', () => {
  clip3.delete()
  track3.delete()
  expect(onLinkDelete).not.toHaveBeenCalled()

  clipPair1Audio.delete()
  expect(onLinkDelete).toHaveBeenCalledWith(expect.objectContaining({ link: clipLinkInit }))
  expect(onLinkDelete).toHaveBeenCalledTimes(1)
  expect(doc.links.get(clipLinkInit.id)).toBeUndefined()

  trackPair1Video.delete()
  expect(onLinkDelete).toHaveBeenCalledWith(expect.objectContaining({ link: trackLinkInit }))
  expect(onLinkDelete).toHaveBeenCalledTimes(2)
  expect(doc.links.get(trackLinkInit.id)).toBeUndefined()
})

test('doc.toJSON() includes links', () => {
  expect(doc.toJSON().links).toEqual([trackLinkInit, clipLinkInit])
})
