import * as gltf from '@gltf-transform/core'
import { expect, test } from 'vitest'

import { MIRU_INTERACTIVITY_FACE_LANDMARKS } from '../constants'

import { InteractivityFaceLandmarks } from './miru-interactivity-face-landmarks'

test('reads and writes face mesh primitive extension', async () => {
  const doc = new gltf.Document()
  const faceLandmarksExtension = doc.createExtension(InteractivityFaceLandmarks)

  doc
    .createScene()
    .addChild(
      doc
        .createNode('face0')
        .setMesh(
          doc
            .createMesh('face0-mesh')
            .addPrimitive(
              doc
                .createPrimitive()
                .setExtension(
                  MIRU_INTERACTIVITY_FACE_LANDMARKS,
                  faceLandmarksExtension.createFaceLandmarksGeometry().setFaceId(0),
                ),
            ),
        ),
    )
    .addChild(
      doc
        .createNode('group')
        .addChild(
          doc
            .createNode('face1')
            .setMesh(
              doc
                .createMesh('face1-mesh')
                .addPrimitive(
                  doc
                    .createPrimitive()
                    .setExtension(
                      MIRU_INTERACTIVITY_FACE_LANDMARKS,
                      faceLandmarksExtension.createFaceLandmarksGeometry().setFaceId(1).setIsOccluder(true),
                    ),
                ),
            ),
        ),
    )

  const io = new gltf.WebIO().registerExtensions([InteractivityFaceLandmarks])

  const result = await io.writeJSON(doc)
  expect(result.json).toMatchInlineSnapshot(`
    {
      "asset": {
        "generator": "glTF-Transform v4.2.0",
        "version": "2.0",
      },
      "extensionsUsed": [
        "MIRU_interactivity_face_landmarks",
      ],
      "meshes": [
        {
          "name": "face0-mesh",
          "primitives": [
            {
              "attributes": {},
              "extensions": {
                "MIRU_interactivity_face_landmarks": {
                  "faceId": 0,
                  "uvMode": undefined,
                },
              },
              "mode": 4,
            },
          ],
        },
        {
          "name": "face1-mesh",
          "primitives": [
            {
              "attributes": {},
              "extensions": {
                "MIRU_interactivity_face_landmarks": {
                  "faceId": 1,
                  "isOccluder": true,
                  "uvMode": undefined,
                },
              },
              "mode": 4,
            },
          ],
        },
      ],
      "nodes": [
        {
          "mesh": 0,
          "name": "face0",
        },
        {
          "children": [
            2,
          ],
          "name": "group",
        },
        {
          "mesh": 1,
          "name": "face1",
        },
      ],
      "scenes": [
        {
          "nodes": [
            0,
            1,
          ],
        },
      ],
    }
  `)

  await expect(io.readJSON(result).then((doc) => io.writeJSON(doc))).resolves.toEqual(result)
})
