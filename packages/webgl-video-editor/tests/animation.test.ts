import { beforeEach, describe, expect, test, vi } from 'vitest'

import type * as pub from '#core'
import { Rational } from 'shared/utils/math.ts'

import type { Animation } from '../src/animation/animation.ts'
import { Keyframe } from '../src/animation/keyframe.ts'
import { EditDocument } from '../src/document-views/edit/edit-document.ts'
import type { EditView } from '../src/document-views/edit/edit-nodes.ts'
import { Document } from '../src/document.ts'

import { docWithTracks } from './test-content.ts'
import { makeAudioClip, makeTextClip, tracksFromString } from './utils.ts'

const LINEAR = [0, 0, 1, 1] as const

let doc: Document
let editDoc: EditDocument

let clipA: pub.VideoClip
let editClipA: EditView.VideoClip
let translateX: Animation<number>
let rotate: Animation<number>

const onNodeListChange = vi.fn()

beforeEach(() => {
  const tracks = tracksFromString(`
#  0         10        20
#  .123456789.123456789.123456789
v [     aaa    ]
a [           b]`)

  doc = new Document({})
  doc.importFromJson(docWithTracks(tracks))
  doc.frameRate = 100

  editDoc = new EditDocument(doc)

  clipA = doc.nodes.get('a')
  editClipA = editDoc.nodes.get('a') as EditView.VideoClip
  translateX = clipA.animations.translateX as Animation<number>
  rotate = clipA.animations.rotate as Animation<number>

  rotate.push(new Keyframe({ value: 0, dt: new Rational(0, 1), easing: LINEAR }))
  rotate.push(new Keyframe({ value: 90, dt: new Rational(2, 1), easing: LINEAR }))

  doc.on('node:list-change', onNodeListChange)
  onNodeListChange.mockClear()
})

describe('animation', () => {
  test(`creates animation from init`, () => {
    const volumeKeyframes: pub.Schema.Keyframe[] = [
      { value: 0, dt: { value: 0, rate: 1 }, easing: LINEAR },
      { value: 1, dt: { value: 1, rate: 1 }, easing: LINEAR },
    ]

    const audioClip = doc.createNode(
      makeAudioClip({ id: 'audio', animations: { volume: { keyframes: volumeKeyframes } } }),
    )
    expect(audioClip.toJSON().animations).toEqual({ volume: { keyframes: volumeKeyframes } })
  })

  test(`edit node sets value directly if no keyframes exist`, () => {
    editClipA.translateX = 10
    expect(clipA.translateX).toBe(10)
    doc.seekTo(clipA.time.end)
    editClipA.translateX = 100
    expect(clipA.translateX).toBe(100)
    doc.seekTo(0)
    expect(clipA.translateX).toBe(100)

    expect(onNodeListChange).not.toHaveBeenCalled()
  })

  test(`updates existing keyframes at current time`, () => {
    expect(clipA.rotate).toBe(0)
    doc.seekTo(clipA.time.start)
    editClipA.rotate = 50
    doc.seekTo(clipA.time.start + 1)
    expect(clipA.rotate).toBe(70)

    expect(onNodeListChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'node:list-change',
        node: clipA,
        path: ['animations', 'rotate', 'keyframes'],
        action: { type: 'update', index: 0, key: 'value', from: 0 },
      }),
    )

    doc.seekTo(clipA.time.start + 2)
    editClipA.rotate = 10
    doc.seekTo(clipA.time.start + 1)
    expect(clipA.rotate).toBe(30)

    expect(onNodeListChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'node:list-change',
        node: clipA,
        path: ['animations', 'rotate', 'keyframes'],
        action: { type: 'update', index: 1, key: 'value', from: 90 },
      }),
    )
  })

  test(`edit node adds to existing keyframes when setting value at a new time`, () => {
    doc.seekTo(clipA.time.start + 1)
    clipA.rotate = 100

    expect(onNodeListChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'node:list-change',
        node: clipA,
        path: ['animations', 'rotate', 'keyframes'],
        action: { type: 'insert', index: 1 },
      }),
    )

    expect(onNodeListChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'node:list-change',
        node: clipA,
        path: ['animations', 'rotate', 'keyframes'],
        action: {
          type: 'update',
          index: 2,
          key: 'dt',
          from: expect.objectContaining({ value: 2, rate: 1 }),
        },
      }),
    )

    doc.seekTo(clipA.time.start + 0.5)
    expect(clipA.rotate).toBe(50)
    doc.seekTo(clipA.time.start + 1.5)
    expect(clipA.rotate).toBe(95)
  })

  test(`node gets value from animation with a single keyframe`, () => {
    translateX.push(new Keyframe({ value: 10, dt: new Rational(0, 1), easing: LINEAR }))

    expect(clipA.translateX).toBe(10)
    doc.seekTo(clipA.time.end)
    expect(clipA.translateX).toBe(10)
  })

  test(`node interpolates between keyframes`, () => {
    translateX.push(new Keyframe({ value: 10, dt: new Rational(1, 1), easing: LINEAR }))
    translateX.push(new Keyframe({ value: 30, dt: new Rational(1, 1), easing: LINEAR }))

    expect(clipA.translateX).toBe(10)
    doc.seekTo(clipA.time.start + 1)
    expect(clipA.translateX).toBe(10)

    doc.seekTo(clipA.time.start + 1.5)
    expect(clipA.translateX).toBe(20)
    doc.seekTo(clipA.time.start + 2)
    expect(clipA.translateX).toBe(30)
    doc.seekTo(doc.duration)
    expect(clipA.translateX).toBe(30)
  })

  test(`interpolates color`, () => {
    const textClip = doc.createNode(
      makeTextClip({
        id: 'audio',
        animations: {
          fill: {
            keyframes: [
              { value: '#ffffff00', dt: { value: 0, rate: 1 }, easing: 'linear' },
              { value: '#000000ff', dt: { value: 2, rate: 1 }, easing: 'linear' },
            ],
          },
        },
      }),
    )

    doc.seekTo(1)
    expect(textClip.fill).toEqual('rgb(50% 50% 50% / 0.5)')
  })

  test(`splits keyframes`, () => {
    expect(rotate.splitAt(new Rational(0, 1))).toEqual({
      sliceTo: rotate.keyframes[0],
      sliceToIndex: 0,
      splitValue: 0,
      isOnKeyframe: true,
    })

    expect(rotate.splitAt(new Rational(1, 1))).toEqual({
      sliceTo: rotate.keyframes[1],
      sliceToIndex: 1,
      splitValue: 45,
      isOnKeyframe: false,
    })

    expect(rotate.splitAt(new Rational(5, 1))).toEqual({
      sliceTo: undefined,
      sliceToIndex: 2,
      splitValue: 90,
      isOnKeyframe: false,
    })
  })

  test(`toggles keyframes`, () => {
    clipA._toggleKeyframesAt(['rotate', 'scaleY'], Rational.ZERO)
    expect(onNodeListChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'node:list-change',
        node: clipA,
        path: ['animations', 'rotate', 'keyframes'],
        action: { type: 'delete', index: 0, item: expect.any(Keyframe) },
      }),
    )
    expect(onNodeListChange).not.toHaveBeenCalledWith(
      expect.objectContaining({
        path: ['animations', 'scaleY', 'keyframes'],
      }),
    )

    clipA._toggleKeyframesAt(['rotate', 'scaleY'], Rational.ZERO)

    expect(onNodeListChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'node:list-change',
        node: clipA,
        path: ['animations', 'rotate', 'keyframes'],
        action: { type: 'insert', index: 0 },
      }),
    )

    expect(onNodeListChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'node:list-change',
        node: clipA,
        path: ['animations', 'scaleY', 'keyframes'],
        action: { type: 'insert', index: 0 },
      }),
    )
  })
})
