import * as gltf from '@gltf-transform/core'
import { type IProperty } from '@gltf-transform/core'
import { Interactivity } from 'gltf-interactivity/src/interactivity'

import { MIRU_INTERACTIVITY_FACE_LANDMARKS } from '../miru-interactivity-face-landmarks/gltf-interactivity-face-landmarks-extension'

export class InteractivityFaceLandmarks extends gltf.Extension {
  static EXTENSION_NAME = MIRU_INTERACTIVITY_FACE_LANDMARKS
  extensionName = MIRU_INTERACTIVITY_FACE_LANDMARKS
  interactivity = this.document.createExtension(Interactivity)

  createFaceLandmarksGeometry(name?: string) {
    return new FaceLandmarksGeometry(this.document.getGraph(), name)
  }

  read(context: gltf.ReaderContext): this {
    context.jsonDoc.json.meshes?.forEach((meshDef, meshIndex) => {
      meshDef.primitives.forEach((primitivDef, primitiveIndex) => {
        const faceLandmarksDetection = primitivDef.extensions?.[MIRU_INTERACTIVITY_FACE_LANDMARKS] as
          | { name?: string; faceId: number; isOccluder?: boolean }
          | undefined
        if (!faceLandmarksDetection) return

        const primitive = context.meshes[meshIndex].listPrimitives()[primitiveIndex]

        primitive.setExtension(
          MIRU_INTERACTIVITY_FACE_LANDMARKS,
          this.createFaceLandmarksGeometry(faceLandmarksDetection.name)
            .setFaceId(faceLandmarksDetection.faceId)
            .setIsOccluder(faceLandmarksDetection.isOccluder ?? false),
        )
      })
    })
    return this
  }

  write(context: gltf.WriterContext): this {
    const { jsonDoc } = context

    this.document
      .getRoot()
      .listMeshes()
      .forEach((mesh) => {
        mesh.listPrimitives().forEach((primitive, primitiveIndex) => {
          const faceLandmarksDetection = primitive.getExtension<FaceLandmarksGeometry>(
            MIRU_INTERACTIVITY_FACE_LANDMARKS,
          )

          if (!faceLandmarksDetection) return

          const meshIndex = context.meshIndexMap.get(mesh)!
          const meshDef = jsonDoc.json.meshes![meshIndex]
          const primitiveExtensions = (meshDef.primitives[primitiveIndex].extensions ??= {})

          const extensionJson = {
            faceId: faceLandmarksDetection.getFaceId(),
          } as Record<string, unknown>

          if (faceLandmarksDetection.getIsOccluder()) extensionJson.isOccluder = true

          primitiveExtensions[MIRU_INTERACTIVITY_FACE_LANDMARKS] = extensionJson
        })
      })

    return this
  }
}

interface IFaceLandmarksGeometry extends IProperty {
  faceId: number
  isOccluder: boolean
}

export class FaceLandmarksGeometry extends gltf.ExtensionProperty<IFaceLandmarksGeometry> {
  static EXTENSION_NAME = MIRU_INTERACTIVITY_FACE_LANDMARKS
  extensionName!: string
  propertyType!: string
  parentTypes!: gltf.PropertyType[]

  init() {
    this.extensionName = MIRU_INTERACTIVITY_FACE_LANDMARKS
    this.propertyType = 'FaceLandmarksGeometry'
    this.parentTypes = [gltf.PropertyType.PRIMITIVE]
  }

  setFaceId(faceId: number) {
    return this.set('faceId', faceId)
  }

  getFaceId() {
    return this.get('faceId')
  }

  setIsOccluder(isOccluder: boolean) {
    return this.set('isOccluder', isOccluder)
  }

  getIsOccluder() {
    return this.get('isOccluder')
  }
}
