import * as Behave from '@behave-graph/core'
import * as THREE from 'three'
import type { GLTFLoaderPlugin, GLTFParser, GLTFReference } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { KHR_INTERACTIVITY, MIRU_INTERACTIVITY_FACE_LANDMARKS } from '../../../constants'
import type { FaceLandmarksGeometryProps, KHRInteractivityExtension } from '../../../types'
import type { GLTFInteractivityExtension } from '../khr-interactivity/gltf-interactivity-extension'

import { FaceLandmarksProcessor, type FaceTransform } from './face-landmarks-processor'
import { EventOnFaceLandmarksChangeNode } from './interactivity-behave-nodes'

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
  parser!: GLTFParser

  processor: FaceLandmarksProcessor
  deviceOrientation = { alpha: 0, beta: 0, gamma: 0 }
  video?: HTMLVideoElement
  interactivity!: GLTFInteractivityExtension

  readonly #faceAttachmentObjects: THREE.Object3D[] = []

  get json(): JsonWithExtensions {
    return this.parser.json
  }

  constructor(options: {
    onDetect?: (faceTransforms: FaceTransform[]) => void
    onInitProgress: (progress: number) => void
    onError: (error: unknown) => void
  }) {
    this.processor = new FaceLandmarksProcessor({
      ...options,
      onDetect: (faceTransforms) => {
        // TODO: should probably eventually rely only on the interactivity graph
        if (faceTransforms.length)
          this.#faceAttachmentObjects.forEach((object) => {
            const forTargetFace = faceTransforms.at(object.userData.faceId ?? 0)
            if (!forTargetFace) return

            const { translation, rotation } = forTargetFace
            object.quaternion.fromArray(rotation)
            object.position.fromArray(translation)
            object.updateMatrix()
          })

        this.emitChanges(faceTransforms)
        options.onDetect?.(faceTransforms)
      },
    })
  }

  init(parser: GLTFParser): this {
    this.parser = parser
    return this
  }

  beforeRoot(): null | Promise<void> {
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

  afterRoot(): null | Promise<void> {
    const { processor, json } = this
    const { meshes = [] } = json

    // check each mesh for face landmark extension properties
    this.parser.associations.forEach((reference, object) => {
      // Testing declaring attachments in Blender custom properties
      if (object.userData.isFaceAttachment === true && object instanceof THREE.Object3D) {
        this.#faceAttachmentObjects.push(object)
        return
      }

      if (
        !(reference as GLTFReference | undefined) ||
        !(object instanceof THREE.Mesh) ||
        reference.meshes === undefined ||
        reference.primitives === undefined
      )
        return

      const primitive = meshes[reference.meshes].primitives[reference.primitives]
      const faceDetection: unknown =
        primitive.extensions?.[MIRU_INTERACTIVITY_FACE_LANDMARKS] ??
        // Testing exporting from Blender with custom properties instead of a custom extension
        object.userData

      if (faceDetection != null && typeof faceDetection === 'object' && 'faceId' in faceDetection) {
        processor.addFaceMesh(
          object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
          faceDetection as any,
        )
      }
    })

    return null
  }

  private emitChanges(faceTransforms: FaceTransform[]): void {
    faceTransforms.forEach((transform, faceIndex) => {
      this.interactivity.emit(
        EventOnFaceLandmarksChangeNode.OP,
        transform,
        (node) => node.configuration.faceId === faceIndex,
      )
    })
  }

  async start(video: HTMLVideoElement): Promise<void> {
    await this.processor.start(video)
  }

  destroy(): void {
    this.processor.dispose()
  }
}
