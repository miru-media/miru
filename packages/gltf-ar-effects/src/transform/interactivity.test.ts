import * as gltf from '@gltf-transform/core'
import { expect, test } from 'vitest'

import { KHR_INTERACTIVITY } from '../constants.ts'
import type { InteractivityType, InteractivityVariable, KHRInteractivityExtension } from '../types.ts'

import { Interactivity } from './interactivity.ts'

test('Interactivity gltf-transform extension', async () => {
  const doc = new gltf.Document()
  const interactivity = doc.createExtension(Interactivity)

  const graph = interactivity.createGraph()

  const TYPES = {
    bool: interactivity.createType().setSignature('bool'),
    float3: interactivity.createType().setSignature('float3'),
    float: interactivity.createType().setSignature('float'),
    int: interactivity.createType().setSignature('int'),
  }

  const DECLARATIONS = {
    eventOnStart: interactivity.createDeclaration().setOp('event/onStart'),
    eventSend: interactivity.createDeclaration().setOp('event/send'),
    pointerSet: interactivity.createDeclaration().setOp('pointer/set'),
    variableGet: interactivity.createDeclaration().setOp('variable/get'),
  }

  const onStartNode = interactivity
    .createNode('on start')
    .setDeclaration(DECLARATIONS.eventOnStart)
    .setFlow(
      'out',
      interactivity
        .createNode('pointer set')
        .setDeclaration(DECLARATIONS.pointerSet)
        .setConfig('pointer', 'nodes/{node}/translation')
        .setConfig('type', TYPES.float3)
        .setInput(
          'value',
          interactivity
            .createNode('get var')
            .setDeclaration(DECLARATIONS.variableGet)
            .setConfig(
              'variable',
              interactivity.createVariable('bool initial false').setType(TYPES.bool).setValue(false),
            )
            .setFlow(
              'out',
              interactivity.createNode('send').setDeclaration(DECLARATIONS.eventSend).createFlow('in'),
            )
            .createFlow('value'),
        )
        .createFlow('in'),
    )
    .setValue('non-existent-input', interactivity.createLiteralValue(TYPES.float, 2.5))

  const mesh = doc.createNode().setMesh(doc.createMesh())

  doc.createScene().addChild(mesh)

  doc
    .getRoot()
    .setExtension(
      KHR_INTERACTIVITY,
      interactivity
        .createRoot()
        .addGraph(
          graph
            .addVariable(interactivity.createVariable('unused int initial 5').setType(TYPES.int).setValue(5))
            .addVariable(interactivity.createVariable('unused int no value').setType(TYPES.int))
            .addNode(onStartNode),
        ),
    )

  const io = new gltf.WebIO().registerExtensions([Interactivity])
  const result = await io.writeJSON(doc)
  const interactivityOutput = result.json.extensions?.[KHR_INTERACTIVITY] as KHRInteractivityExtension

  {
    const { types, variables } = interactivityOutput.graphs![0]

    expect(types?.sort((a, b) => a.signature.localeCompare(b.signature))).toEqual<InteractivityType[]>([
      { signature: 'bool' },
      { signature: 'float' },
      { signature: 'float3' },
      { signature: 'int' },
    ])

    expect(variables).toEqual<InteractivityVariable[]>([
      { name: 'unused int initial 5', type: 0, value: [5] },
      { name: 'unused int no value', type: 0 },
      { name: 'bool initial false', type: 2, value: [false] },
    ])

    /* prettier-ignore */
    expect(interactivityOutput).toMatchInlineSnapshot(`
      {
        "graphs": [
          {
            "declarations": [
              {
                "op": "event/onStart",
              },
              {
                "op": "pointer/set",
              },
              {
                "op": "variable/get",
              },
              {
                "op": "event/send",
              },
            ],
            "nodes": [
              {
                "declaration": 0,
                "flows": {
                  "out": {
                    "node": 1,
                    "socket": "in",
                  },
                },
                "name": "on start",
                "values": {
                  "non-existent-input": {
                    "type": 1,
                    "value": [
                      2.5,
                    ],
                  },
                },
              },
              {
                "configuration": {
                  "pointer": {
                    "value": [
                      "nodes/{node}/translation",
                    ],
                  },
                  "type": {
                    "value": [
                      3,
                    ],
                  },
                },
                "declaration": 1,
                "name": "pointer set",
                "values": {
                  "value": {
                    "node": 2,
                    "socket": "value",
                  },
                },
              },
              {
                "configuration": {
                  "variable": {
                    "value": [
                      2,
                    ],
                  },
                },
                "declaration": 2,
                "flows": {
                  "out": {
                    "node": 3,
                    "socket": "in",
                  },
                },
                "name": "get var",
              },
              {
                "declaration": 3,
                "name": "send",
              },
            ],
            "types": [
              {
                "signature": "bool",
              },
              {
                "signature": "float",
              },
              {
                "signature": "float3",
              },
              {
                "signature": "int",
              },
            ],
            "variables": [
              {
                "name": "unused int initial 5",
                "type": 0,
                "value": [
                  5,
                ],
              },
              {
                "name": "unused int no value",
                "type": 0,
              },
              {
                "name": "bool initial false",
                "type": 2,
                "value": [
                  false,
                ],
              },
            ],
          },
        ],
      }
    `)

    await expect(io.writeJSON(await io.readJSON(result))).resolves.toEqual(result)
  }
})
