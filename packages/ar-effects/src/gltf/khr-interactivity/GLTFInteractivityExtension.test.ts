import { KHR_INTERACTIVITY } from 'gltf-interactivity/src/constants'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { expect, test, vi } from 'vitest'

import { GLTFInteractivityExtension } from './GLTFInteractivityExtension'

test('loads without error', async () => {
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
              types: [{ name: 'int', signature: 'int' }],
              variables: [],
              events: [{ id: 'test-event', values: { testValue: { type: 0 } } }],
              declarations: [{ op: 'event/receive' }, { op: 'event/send' }],
              nodes: [
                {
                  name: 'receive test event',
                  declaration: 0,
                  configuration: { event: { value: [0] } },
                  flows: { out: { node: 1 } },
                },
                { name: 'send test event', declaration: 1, configuration: { event: { value: [0] } } },
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

  interactivity.engine.graph.customEvents['test-event'].eventEmitter.addListener(onSend)
  interactivity.emitCustomEvent('test-event', {})

  expect(onSend).toHaveBeenCalledOnce()
})
