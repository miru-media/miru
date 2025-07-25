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
  "meshes": [
    {
      "name": "face0-mesh",
      "primitives": [
        {
          "attributes": {},
          "mode": 4,
          "extensions": { "MIRU_interactivity_face_landmarks": { "faceId": 0 } }
        }
      ]
    },
    {
      "name": "face0-occluder-mesh",
      "primitives": [
        {
          "attributes": {},
          "mode": 4,
          "extensions": { "MIRU_interactivity_face_landmarks": { "faceId": 0 } }
        }
      ],
      "extensions": { "MIRU_mesh_occluder": {} }
    }
  ],
  "nodes": [
    { "name": "attachment" },
    { "name": "face0", "mesh": 0 },
    { "name": "face0-occluder", "mesh": 1 }
  ],
  "scenes": [{ "nodes": [0, 1, 2] }],
  "scene": 0,
  "extensionsUsed": ["KHR_interactivity", "MIRU_interactivity_face_landmarks", "MIRU_mesh_occluder"],
  "extensions": {
    "KHR_interactivity": {
      "graph": 0,
      "graphs": [
        {
          "types": [{ "signature": "float3" }, { "signature": "int" }, { "signature": "bool" }],
          "declarations": [{ "op": "landmarks/faceUpdate" }, { "op": "pointer/set" }],
          "nodes": [
            {
              "name": "on face landmarks change",
              "declaration": 0,
              "flows": {
                "start": { "node": 1, "socket": "in" },
                "end": { "node": 3, "socket": "in" },
                "change": { "node": 5, "socket": "in" }
              },
              "configuration": { "faceId": { "value": [0] } }
            },
            {
              "declaration": 1,
              "values": {
                "value": { "value": [true], "type": 2 },
                "node": { "value": [0], "type": 1 }
              },
              "flows": { "out": { "node": 2, "socket": "in" } },
              "configuration": {
                "pointer": {
                  "value": ["/nodes/{node}/extensions/KHR_node_visibility/visible"]
                },
                "type": { "value": [2] }
              }
            },
            {
              "declaration": 1,
              "values": {
                "value": { "value": [true], "type": 2 },
                "node": { "value": [1], "type": 1 }
              },
              "configuration": {
                "pointer": {
                  "value": ["/nodes/{node}/extensions/KHR_node_visibility/visible"]
                },
                "type": { "value": [2] }
              }
            },
            {
              "declaration": 1,
              "values": {
                "value": { "value": [false], "type": 2 },
                "node": { "value": [0], "type": 1 }
              },
              "flows": { "out": { "node": 4, "socket": "in" } },
              "configuration": {
                "pointer": {
                  "value": ["/nodes/{node}/extensions/KHR_node_visibility/visible"]
                },
                "type": { "value": [2] }
              }
            },
            {
              "declaration": 1,
              "values": {
                "value": { "value": [false], "type": 2 },
                "node": { "value": [1], "type": 1 }
              },
              "configuration": {
                "pointer": {
                  "value": ["/nodes/{node}/extensions/KHR_node_visibility/visible"]
                },
                "type": { "value": [2] }
              }
            },
            {
              "name": "update face attachment position",
              "declaration": 1,
              "values": {
                "node": { "value": [0], "type": 1 },
                "value": { "node": 0, "socket": "translation" }
              },
              "flows": { "out": { "node": 6, "socket": "in" } },
              "configuration": {
                "pointer": { "value": ["/nodes/{node}/translation"] },
                "type": { "value": [0] }
              }
            },
            {
              "name": "update face attachment rotation",
              "declaration": 1,
              "values": {
                "node": { "value": [0], "type": 1 },
                "value": { "node": 0, "socket": "rotation" }
              },
              "configuration": {
                "pointer": { "value": ["/nodes/{node}/rotation"] },
                "type": { "value": [0] }
              }
            }
          ]
        }
      ]
    }
  }
}
```
