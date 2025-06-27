# Experimental AR effects for web browsers

This package explores creating realtime, 3D AR effects such as filters with face landmark detection using on-device machine learning models from [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide). Effects are defined in [glTF format](https://www.khronos.org/gltf/), with a few extensions:

- [KHR_interactivity](https://github.com/KhronosGroup/glTF/blob/interactivity/extensions/2.0/Khronos/KHR_interactivity/Specification.adoc), a draft specification for events and node-based scripting and
- MIRU_interactivity_face_landmarks, an experimental extension for integrating face landmark detection from a video stream.

You can try out a demo effect at https://miru.media/ar-effects.

## Package contents

| directory                                  | contents                                                                                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/transform`](./src/transform)         | [glTF Transform](https://gltf-transform.dev/) extensions for reading and writing asset files. These can be used to [programatically create effect files](../../docs/ar-effects-demo/sample-gltf.ts) |
| [`src/three/loaders`](./src/three/loaders) | [Three.js glTF loader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader) to load glTF effect files and run them in a browser.                                                               |
