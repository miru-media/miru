# Experimental AR effects for web browsers

This package explores creating realtime, 3D AR selfie-mode effects such as filters with face landmark detection using on-device machine learning models from [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide). Effects are defined in [glTF format](https://www.khronos.org/gltf/), with a few extensions:

- [KHR_interactivity](https://github.com/KhronosGroup/glTF/blob/interactivity/extensions/2.0/Khronos/KHR_interactivity/Specification.adoc), a draft specification for events and node-based scripting and
- MIRU_interactivity_face_landmarks, an experimental extension for integrating face landmark detection from a video stream.

You can try out a demo effect at <https://miru.media/ar-effects>.

## Package contents

| directory                                  | contents                                                                                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/transform`](./src/transform)         | [glTF Transform](https://gltf-transform.dev/) extensions for reading and writing asset files. These can be used to [programatically create effect files](../../docs/ar-effects-demo/sample-gltf.ts) |
| [`src/three/loaders`](./src/three/loaders) | [Three.js glTF loader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader) to load glTF effect files and run them in a browser.                                                               |

## glTF JSON example

```json
{
  "asset": { "generator": "glTF-Transform v4.2.0", "version": "2.0" },
  "materials": [
    {
      "alphaMode": "BLEND",
      "pbrMetallicRoughness": {
        "baseColorFactor": [1, 0.6795424696265424, 0, 0.675],
        "roughnessFactor": 0.001
      }
    }
  ],
  "meshes": [
    {
      "name": "face0-mesh",
      "primitives": [
        {
          "attributes": {},
          "mode": 4,
          "material": 0,
          "extensions": { "MIRU_interactivity_face_landmarks": { "faceId": 0 } }
        },
        {
          "attributes": {},
          "mode": 4,
          "extensions": {
            "MIRU_interactivity_face_landmarks": { "faceId": 0, "isOccluder": true }
          }
        }
      ]
    }
  ],
  "nodes": [{ "name": "face0", "mesh": 0 }, { "name": "glasses-attachment" }],
  "scenes": [{ "nodes": [0] }],
  "scene": 0,
  "extensionsUsed": ["KHR_interactivity", "MIRU_interactivity_face_landmarks"],
  "extensions": {
    "KHR_interactivity": {
      "graph": 0,
      "graphs": [
        {
          "types": [{ "signature": "int" }, { "signature": "float3" }],
          "events": [
            {
              "id": "test-event",
              "values": { "testValue": { "value": [0], "type": 0 } }
            }
          ],
          "declarations": [{ "op": "event/send" }, { "op": "faceLandmarks/change" }, { "op": "pointer/set" }],
          "nodes": [
            {
              "name": "test event",
              "declaration": 0,
              "configuration": { "event": { "value": [0] } }
            },
            {
              "name": "on face landmarks change",
              "declaration": 1,
              "flows": { "out": { "node": 2, "socket": "in" } },
              "configuration": { "faceId": { "value": [0] } }
            },
            {
              "name": "update face attachment position",
              "declaration": 2,
              "values": {
                "node": { "value": [1], "type": 0 },
                "value": { "node": 1, "socket": "translation" }
              },
              "flows": { "out": { "node": 3, "socket": "in" } },
              "configuration": {
                "pointer": { "value": ["/nodes/{node}/translation"] },
                "type": { "value": [1] }
              }
            },
            {
              "name": "update face attachment rotation",
              "declaration": 2,
              "values": { "value": { "node": 1, "socket": "rotation" } },
              "configuration": {
                "pointer": { "value": ["/nodes/1/rotation"] },
                "type": { "value": [1] }
              }
            }
          ]
        }
      ]
    }
  }
}
```
