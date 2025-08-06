import * as gltf from '@gltf-transform/core'
import type { IProperty } from '@gltf-transform/core'

import { MIRU_INTERACTIVITY_FACE_LANDMARKS } from '../constants.ts'
import type { FaceLandmarksGeometryProps, FaceLandmarksUvMode } from '../types.ts'

import { Interactivity } from './interactivity.ts'

export class InteractivityFaceLandmarks extends gltf.Extension {
  static EXTENSION_NAME: typeof MIRU_INTERACTIVITY_FACE_LANDMARKS = MIRU_INTERACTIVITY_FACE_LANDMARKS
  extensionName: typeof MIRU_INTERACTIVITY_FACE_LANDMARKS = MIRU_INTERACTIVITY_FACE_LANDMARKS
  interactivity = this.document.createExtension(Interactivity)

  createFaceLandmarksGeometry(name?: string): FaceLandmarksGeometry {
    return new FaceLandmarksGeometry(this.document.getGraph(), name)
  }

  read(context: gltf.ReaderContext): this {
    context.jsonDoc.json.meshes?.forEach((meshDef, meshIndex) => {
      meshDef.primitives.forEach((primitivDef, primitiveIndex) => {
        const faceLandmarksDetection = primitivDef.extensions?.[MIRU_INTERACTIVITY_FACE_LANDMARKS] as
          | FaceLandmarksGeometryProps
          | undefined
        if (!faceLandmarksDetection) return

        const primitive = context.meshes[meshIndex].listPrimitives()[primitiveIndex]

        primitive.setExtension(
          MIRU_INTERACTIVITY_FACE_LANDMARKS,
          this.createFaceLandmarksGeometry(faceLandmarksDetection.name)
            .setFaceId(faceLandmarksDetection.faceId)
            .setUvMode(faceLandmarksDetection.uvMode ?? null),
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

          const extensionJson: Record<string, unknown> = {
            faceId: faceLandmarksDetection.getFaceId(),
            uvMode: faceLandmarksDetection.getUvMode() ?? undefined,
          }

          primitiveExtensions[MIRU_INTERACTIVITY_FACE_LANDMARKS] = extensionJson
        })
      })

    return this
  }
}

interface IFaceLandmarksGeometry extends IProperty {
  faceId: number
  uvMode: FaceLandmarksUvMode | null
}

export class FaceLandmarksGeometry extends gltf.ExtensionProperty<IFaceLandmarksGeometry> {
  static EXTENSION_NAME = MIRU_INTERACTIVITY_FACE_LANDMARKS
  declare extensionName: string
  declare propertyType: string
  declare parentTypes: gltf.PropertyType[]

  init(): void {
    this.extensionName = MIRU_INTERACTIVITY_FACE_LANDMARKS
    this.propertyType = 'FaceLandmarksGeometry'
    this.parentTypes = [gltf.PropertyType.PRIMITIVE]
  }

  getDefaults() {
    return Object.assign(super.getDefaults(), {
      faceId: 0,
    })
  }

  setFaceId(faceId: number): this {
    return this.set('faceId', faceId)
  }

  getFaceId(): number {
    return this.get('faceId')
  }

  // TODO: this should be done in the interactivity graph
  setUvMode(mode: FaceLandmarksUvMode | null): this {
    return this.set('uvMode', mode)
  }
  getUvMode(): IFaceLandmarksGeometry['uvMode'] {
    return this.get('uvMode')
  }
}
