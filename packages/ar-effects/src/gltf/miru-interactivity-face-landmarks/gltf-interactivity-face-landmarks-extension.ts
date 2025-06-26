import * as Behave from '@behave-graph/core'
import { KHR_INTERACTIVITY } from 'gltf-interactivity/src/constants'
import { type KHRInteractivityExtension } from 'gltf-interactivity/src/types'
import * as THREE from 'three'
import {
  type GLTFLoaderPlugin,
  type GLTFParser,
  type GLTFReference,
} from 'three/examples/jsm/loaders/GLTFLoader.js'

import { FACEMESH_VERTEX_INDICES, LANDMARKS_VERTEX_COUNT, MAX_LANDMARK_FACES } from '../../constants'
import { type GLTFInteractivityExtension } from '../khr-interactivity/GLTFInteractivityExtension'

import { EventOnFaceLandmarksChangeNode } from './interactivity-behave-nodes'

export const MIRU_INTERACTIVITY_FACE_LANDMARKS = 'MIRU_interactivity_face_landmarks'

export class GLTFFaceLandmarkDetectionExtension implements GLTFLoaderPlugin {
  name: typeof MIRU_INTERACTIVITY_FACE_LANDMARKS = MIRU_INTERACTIVITY_FACE_LANDMARKS
  parser!: GLTFParser

  isMirrored = false
  faceMeshGeometries: Record<number, THREE.BufferGeometry[] | undefined> = {}
  faceGeometryPositions: THREE.Float32BufferAttribute[] = []
  faceGeometryIndex = new THREE.Uint16BufferAttribute(FACEMESH_VERTEX_INDICES, 1)

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

  init(parser: GLTFParser) {
    this.parser = parser
    return this
  }

  beforeRoot() {
    const interactivityJson = this.json.extensions?.[KHR_INTERACTIVITY]
    if (!interactivityJson) return null

    const interactivity = this.parser.plugins[KHR_INTERACTIVITY] as GLTFInteractivityExtension | undefined
    if (!interactivity) return null

    const { registry } = interactivity

    registry.nodes.register(
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
    const { meshes } = this.json
    if (!meshes) return null

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
        geometry.setAttribute('position', this.getFaceGeometryPosition(faceId))
        geometry.attributes.position.needsUpdate = true
        geometry.setIndex(this.faceGeometryIndex)
        geometry.computeVertexNormals()

        material.flatShading = false

        if (isOccluder) {
          object.renderOrder = -1
          material.colorWrite = false
        }
        ;(this.faceMeshGeometries[faceId] ??= []).push(geometry)
      }
    })

    return null
  }

  getFaceGeometryPosition(faceIndex: number) {
    return (this.faceGeometryPositions[faceIndex] ??= new THREE.Float32BufferAttribute(
      LANDMARKS_VERTEX_COUNT * 3,
      3,
    ))
  }

  updateFaceGeometries(faceId: number, mirror: boolean) {
    if (this.isMirrored !== mirror) {
      const { array } = this.faceGeometryIndex
      let temp
      for (let i = 0, length = array.length; i < length; i += 3) {
        temp = array[i]
        array[i] = array[i + 2]
        array[i + 2] = temp
      }
      this.isMirrored = mirror
    }

    this.faceMeshGeometries[faceId]?.forEach((geometry) => {
      geometry.computeVertexNormals()
      geometry.getAttribute('position').needsUpdate = true
    })
  }
}
