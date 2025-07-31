import * as gltf from '@gltf-transform/core'
import { expect, test } from 'vitest'

import { MIRUMeshOccluder } from './mesh-occluder.ts'
import { InteractivityFaceLandmarks } from './miru-interactivity-face-landmarks.ts'

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
                  faceLandmarksExtension.extensionName,
                  faceLandmarksExtension.createFaceLandmarksGeometry().setFaceId(0),
                ),
            ),
        ),
    )
    .addChild(
      doc.createNode('group').addChild(
        doc.createNode('face1').setMesh(
          doc
            .createMesh('face1-mesh')
            .addPrimitive(
              doc
                .createPrimitive()
                .setExtension(
                  faceLandmarksExtension.extensionName,
                  faceLandmarksExtension.createFaceLandmarksGeometry().setFaceId(1),
                ),
            )
            .setExtension(
              MIRUMeshOccluder.EXTENSION_NAME,
              doc.createExtension(MIRUMeshOccluder).createOccluder(),
            ),
        ),
      ),
    )

  const io = new gltf.WebIO().registerExtensions([InteractivityFaceLandmarks, MIRUMeshOccluder])

  const result = await io.writeJSON(doc)
  expect(result.json).toMatchInlineSnapshot(`
    {
      "asset": {
        "generator": "glTF-Transform v4.2.0",
        "version": "2.0",
      },
      "extensionsUsed": [
        "MIRU_interactivity_face_landmarks",
        "MIRU_mesh_occluder",
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
          "extensions": {
            "MIRU_mesh_occluder": {},
          },
          "name": "face1-mesh",
          "primitives": [
            {
              "attributes": {},
              "extensions": {
                "MIRU_interactivity_face_landmarks": {
                  "faceId": 1,
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
