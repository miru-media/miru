import * as gltf from '@gltf-transform/core'

import { MIRU_MESH_OCCLUDER } from '../constants.ts'

export class MIRUMeshOccluder extends gltf.Extension {
  public static readonly EXTENSION_NAME: typeof MIRU_MESH_OCCLUDER = MIRU_MESH_OCCLUDER
  public readonly extensionName: typeof MIRU_MESH_OCCLUDER = MIRU_MESH_OCCLUDER

  createOccluder(): Occluder {
    return new Occluder(this.document.getGraph())
  }

  read(context: gltf.ReaderContext): this {
    context.jsonDoc.json.meshes?.forEach((meshDef, meshIndex) => {
      const occluder = meshDef.extensions?.[MIRU_MESH_OCCLUDER]

      if (occluder != null) {
        context.meshes[meshIndex].setExtension(MIRU_MESH_OCCLUDER, this.createOccluder())
      }
    })
    return this
  }

  write(context: gltf.WriterContext): this {
    const { jsonDoc } = context

    this.document
      .getRoot()
      .listMeshes()
      .forEach((mesh) => {
        if (mesh.getExtension<Occluder>(MIRU_MESH_OCCLUDER)) {
          const meshDef = jsonDoc.json.meshes![context.meshIndexMap.get(mesh)!]
          ;(meshDef.extensions ??= {})[MIRU_MESH_OCCLUDER] ??= {}
        }
      })

    return this
  }
}

export class Occluder extends gltf.ExtensionProperty {
  public static EXTENSION_NAME: typeof MIRU_MESH_OCCLUDER = MIRU_MESH_OCCLUDER
  declare public extensionName: typeof MIRU_MESH_OCCLUDER
  declare public propertyType: 'Occluder'
  declare public parentTypes: [gltf.PropertyType.MESH]

  protected init(): void {
    this.extensionName = MIRU_MESH_OCCLUDER
    this.propertyType = 'Occluder'
    this.parentTypes = [gltf.PropertyType.MESH]
  }
}
