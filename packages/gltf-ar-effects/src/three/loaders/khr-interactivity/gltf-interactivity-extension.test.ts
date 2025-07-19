import type { GLTF } from '@gltf-transform/core'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { expect, test, vi } from 'vitest'

import { KHR_INTERACTIVITY } from '../../../constants'
import type { KHRInteractivityExtension } from '../../../types'

import { GLTFInteractivityExtension } from './gltf-interactivity-extension'

test('receive and send custom events', async () => {
  const onSend = vi.fn()

  const interactivity = new GLTFInteractivityExtension()
  const loader = new GLTFLoader().register((parser) => interactivity.init(parser))

  await loader.parseAsync(
    JSON.stringify({
      asset: { version: '2.0' },
      extensions: {
        [KHR_INTERACTIVITY]: {
          graphs: [
            {
              types: [{ signature: 'int' }],
              variables: [],
              events: [
                { id: 'received-by-graph', values: { testValue: { type: 0 } } },
                { id: 'sent-from-graph', values: { testValue: { type: 0 } } },
              ],
              declarations: [{ op: 'event/receive' }, { op: 'event/send' }],
              nodes: [
                {
                  name: 'receive test event',
                  declaration: 0,
                  configuration: { event: { value: [0] } },
                  flows: { out: { node: 1 } },
                },
                { name: 'send test event', declaration: 1, configuration: { event: { value: [1] } } },
              ],
            },
          ],
          graph: 0,
        },
      },
    }),
    '',
  )

  expect(onSend).not.toHaveBeenCalled()

  interactivity.engine.graph.customEvents['sent-from-graph'].eventEmitter.addListener(onSend)
  interactivity.emitCustomEvent('received-by-graph', {})

  expect(onSend).toHaveBeenCalledOnce()
})

test('property/set', async () => {
  const interactivity = new GLTFInteractivityExtension()
  const loader = new GLTFLoader().register((parser) => interactivity.init(parser))

  const gltf = await loader.parseAsync(
    JSON.stringify({
      asset: { version: '2.0' },
      nodes: [{ name: 'node-0' }, { name: 'node-1' }, { name: 'node-2' }],
      scenes: [{ nodes: [0, 1, 2] }],
      scene: 0,
      extensions: {
        [KHR_INTERACTIVITY]: {
          graphs: [
            {
              types: [
                { signature: 'int' },
                { signature: 'float3' },
                { signature: 'float4' },
                { signature: 'bool' },
              ],
              variables: [],
              events: [
                {
                  id: 'received-by-graph',
                  values: { receivedEventValue: { type: 2, value: [-1, -1, -1, -1] } },
                },
              ],
              declarations: [{ op: 'event/receive' }, { op: 'pointer/set' }],
              nodes: [
                {
                  name: 'receive test event',
                  declaration: 0,
                  configuration: { event: { value: [0] } },
                  flows: { out: { node: 1 } },
                },
                {
                  name: `assign fixed value to third node's translation`,
                  declaration: 1,
                  configuration: {
                    pointer: { value: ['/nodes/{node}/translation'] },
                    type: { value: [1] },
                  },
                  values: {
                    node: { type: 0, value: [2] },
                    value: { type: 1, value: [1, 2, 3] },
                  },
                  flows: { out: { node: 2 } },
                },
                {
                  name: `assign value from event to first node's rotation`,
                  declaration: 1,
                  configuration: {
                    pointer: { value: ['/nodes/{node}/rotation'] },
                    type: { value: [2] },
                  },
                  values: {
                    node: { type: 0, value: [0] },
                    value: { type: 2, node: 0, socket: 'receivedEventValue' },
                  },
                  flows: { out: { node: 3 } },
                },
                {
                  name: 'set visibility',
                  declaration: 1,
                  configuration: {
                    pointer: {
                      value: ['/nodes/{node}/extensions/KHR_node_visibility/visible'],
                    },
                    type: { value: [2] },
                  },
                  values: {
                    node: { type: 0, value: [1] },
                    value: { type: 3, value: [false] },
                  },
                },
              ],
            },
          ],
          graph: 0,
        } satisfies KHRInteractivityExtension,
      },
    } satisfies GLTF.IGLTF),
    '',
  )

  expect(gltf.scene.children.map((c) => c.visible)).toEqual([true, true, true])
  expect(gltf.scene.children.map((c) => c.position.toArray())).toEqual([
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ])
  expect(gltf.scene.children.map((c) => c.quaternion.toJSON())).toEqual([
    [0, 0, 0, 1],
    [0, 0, 0, 1],
    [0, 0, 0, 1],
  ])

  interactivity.emitCustomEvent('received-by-graph', { receivedEventValue: [4, 5, 6, 7] })

  expect(gltf.scene.children.map((c) => c.visible)).toEqual([true, false, true])
  expect(gltf.scene.children.map((c) => c.position.toArray())).toEqual([
    [0, 0, 0],
    [0, 0, 0],
    [1, 2, 3],
  ])
  expect(gltf.scene.children.map((c) => c.quaternion.toJSON())).toEqual([
    [4, 5, 6, 7],
    [0, 0, 0, 1],
    [0, 0, 0, 1],
  ])
})
