import * as Behave from '@behave-graph/core'
import * as THREE from 'three'
import type { GLTFLoaderPlugin, GLTFParser, GLTFReference } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { KHR_INTERACTIVITY, MAX_LANDMARK_FACES, MIRU_INTERACTIVITY_FACE_LANDMARKS } from '../../../constants'
import type { KHRInteractivityExtension } from '../../../types'
import type { GLTFInteractivityExtension } from '../khr-interactivity/gltf-interactivity-extension'

import { FaceLandmarksProcessor, type FaceTransform } from './face-landmarks-processor'
import { EventOnFaceLandmarksChangeNode } from './interactivity-behave-nodes'

export class GLTFFaceLandmarkDetectionExtension implements GLTFLoaderPlugin {
  name: typeof MIRU_INTERACTIVITY_FACE_LANDMARKS = MIRU_INTERACTIVITY_FACE_LANDMARKS
  parser!: GLTFParser

  processor: FaceLandmarksProcessor
  video?: HTMLVideoElement
  interactivity!: GLTFInteractivityExtension

  get json() {
    return this.parser.json as {
      meshes?: {
        primitives: {
          extensions?: {
            [MIRU_INTERACTIVITY_FACE_LANDMARKS]?: { faceId: number; isOccluder?: boolean }
          }
        }[]
      }[]
      extensions?: { [KHR_INTERACTIVITY]?: KHRInteractivityExtension }
    }
  }

  constructor(options: {
    onDetect?: (faceTransforms: FaceTransform[]) => void
    onInitProgress: (progress: number) => void
    onError: (error: unknown) => void
  }) {
    this.processor = new FaceLandmarksProcessor({
      ...options,
      onDetect: (faceTransforms) => {
        this.emitChanges(faceTransforms)
        options.onDetect?.(faceTransforms)
      },
    })
  }

  init(parser: GLTFParser) {
    this.parser = parser
    return this
  }

  beforeRoot() {
    const interactivityJson = this.json.extensions?.[KHR_INTERACTIVITY]
    if (!interactivityJson) return null

    const interactivity = this.parser.plugins[KHR_INTERACTIVITY] as GLTFInteractivityExtension | undefined
    if (!interactivity) throw new Error(`Missing ${KHR_INTERACTIVITY} extension.`)

    this.interactivity = interactivity

    interactivity.registry.nodes.register(
      new Behave.NodeDescription(
        EventOnFaceLandmarksChangeNode.OP,
        'Event',
        EventOnFaceLandmarksChangeNode.OP,
        (description, graph, config) => new EventOnFaceLandmarksChangeNode(description, graph, config),
        undefined,
        `An event that's fired when a face's detected landmarks change.`,
      ),
    )

    return null
  }

  afterRoot() {
    const { processor, json } = this
    const { meshes = [] } = json

    // check each mesh for face detection `extra` properties
    this.parser.associations.forEach((reference, object) => {
      if (
        !(reference as GLTFReference | undefined) ||
        !(object instanceof THREE.Mesh) ||
        reference.meshes === undefined ||
        reference.primitives === undefined
      )
        return

      const primitive = meshes[reference.meshes].primitives[reference.primitives]
      const faceDetection = primitive.extensions?.[MIRU_INTERACTIVITY_FACE_LANDMARKS]

      if (faceDetection) {
        const { faceId, isOccluder } = faceDetection

        if (faceId >= MAX_LANDMARK_FACES)
          throw new Error(`Maximum ${MAX_LANDMARK_FACES} detected faces. Got ${faceId}.`)

        const { geometry, material } = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

        material.flatShading = false

        if (isOccluder) {
          object.renderOrder = -1
          material.colorWrite = false
        }

        processor.addFaceGeometry(faceId, geometry)
      }
    })

    return null
  }

  emitChanges(faceTransforms: FaceTransform[]) {
    faceTransforms.forEach((transform, faceIndex) => {
      this.interactivity.emit(
        EventOnFaceLandmarksChangeNode.OP,
        transform,
        (node) => node.configuration.faceId === faceIndex,
      )
    })
  }

  async start(video: HTMLVideoElement) {
    await this.processor.start(video)
  }

  destroy() {
    this.processor.dispose()
  }
}
