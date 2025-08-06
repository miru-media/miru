import * as Behave from '@behave-graph/core'
import * as THREE from 'three'
import type { GLTFLoaderPlugin, GLTFParser, GLTFReference } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { KHR_INTERACTIVITY, MIRU_INTERACTIVITY_FACE_LANDMARKS } from '../../../constants.ts'
import type { FaceLandmarksGeometryProps, KHRInteractivityExtension } from '../../../types.ts'
import type { GLTFInteractivityExtension } from '../khr-interactivity/gltf-interactivity-extension.ts'

import type { FaceLandmarksProcessor, FaceTransform, ProcessEvent } from './face-landmarks-processor.ts'
import { LandmarksFaceNode } from './interactivity-behave-nodes.ts'

interface JsonWithExtensions {
  meshes?: {
    primitives: {
      extensions?: {
        [MIRU_INTERACTIVITY_FACE_LANDMARKS]?: FaceLandmarksGeometryProps
      }
    }[]
  }[]
  extensions?: { [KHR_INTERACTIVITY]?: KHRInteractivityExtension }
}

export class GLTFFaceLandmarkDetectionExtension implements GLTFLoaderPlugin {
  name: typeof MIRU_INTERACTIVITY_FACE_LANDMARKS = MIRU_INTERACTIVITY_FACE_LANDMARKS
  parser: GLTFParser

  processor: FaceLandmarksProcessor
  deviceOrientation = { alpha: 0, beta: 0, gamma: 0 }
  video?: HTMLVideoElement
  interactivity!: GLTFInteractivityExtension

  private prevEmittedFaceCount = 0

  get json(): JsonWithExtensions {
    return this.parser.json
  }

  readonly #onProcess = (result: ProcessEvent): void => this.emitChanges(result.faceTransforms)

  constructor(options: { parser: GLTFParser; processor: FaceLandmarksProcessor }) {
    this.parser = options.parser
    this.processor = options.processor

    this.processor.addEventListener('process', this.#onProcess as any)
  }

  beforeRoot(): null | Promise<void> {
    const interactivity = this.parser.plugins[KHR_INTERACTIVITY] as GLTFInteractivityExtension | undefined
    if (!interactivity) throw new Error(`Missing ${KHR_INTERACTIVITY} extension.`)

    this.interactivity = interactivity

    interactivity.registry.nodes.register(
      new Behave.NodeDescription(
        LandmarksFaceNode.OP,
        'Flow',
        LandmarksFaceNode.OP,
        (description, graph, config) => new LandmarksFaceNode(description, graph, config),
        undefined,
        `An event that's fired when a face's landmarks are found, lost, or updated.`,
      ),
    )

    return null
  }

  afterRoot(): null | Promise<void> {
    const { processor, json } = this
    const { meshes = [] } = json

    // check each mesh for face landmark extension properties
    this.parser.associations.forEach((reference, object) => {
      if (
        !(reference as GLTFReference | undefined) ||
        !(object instanceof THREE.Mesh) ||
        reference.meshes === undefined ||
        reference.primitives === undefined
      )
        return

      const primitive = meshes[reference.meshes].primitives[reference.primitives]
      const extensionProps = primitive.extensions?.[MIRU_INTERACTIVITY_FACE_LANDMARKS]

      if (extensionProps) {
        processor.addFaceMesh(
          object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
          extensionProps,
        )
      }
    })

    return null
  }

  private emitChanges(faceTransforms: FaceTransform[]): void {
    const { prevEmittedFaceCount } = this

    for (let i = faceTransforms.length; i < prevEmittedFaceCount; i++) {
      this.interactivity.emit(LandmarksFaceNode.OP, {}, (node) => node.configuration.faceId === i, ['end'])
    }

    faceTransforms.forEach((transform, faceIndex) => {
      if (faceIndex >= prevEmittedFaceCount) {
        this.interactivity.emit(
          LandmarksFaceNode.OP,
          transform,
          (node) => node.configuration.faceId === faceIndex,
          ['start'],
        )
      }

      this.interactivity.emit(
        LandmarksFaceNode.OP,
        transform,
        (node) => node.configuration.faceId === faceIndex,
        ['change'],
      )
    })

    this.prevEmittedFaceCount = faceTransforms.length
  }

  async start(video: HTMLVideoElement): Promise<void> {
    await this.processor.start(video)
  }

  dispose(): void {
    this.processor.removeEventListener('process', this.#onProcess as any)
  }
}
