import type * as gltf from '@gltf-transform/core'
import * as THREE from 'three'
import type { GLTFLoaderPlugin, GLTFParser, GLTFReference } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { MIRU_MESH_OCCLUDER } from '../../constants.ts'

export class GLTFMeshOccluderExtension implements GLTFLoaderPlugin {
  name: typeof MIRU_MESH_OCCLUDER = MIRU_MESH_OCCLUDER
  parser: GLTFParser

  constructor(parser: GLTFParser) {
    this.parser = parser
  }

  afterRoot(): null {
    const { meshes } = this.parser.json as gltf.GLTF.IGLTF

    if (!meshes) return null

    this.parser.associations.forEach((reference, object) => {
      if (!(reference as GLTFReference | undefined) || !(object instanceof THREE.Mesh)) return
      if (reference.meshes === undefined) return

      const mesh = meshes[reference.meshes]

      if (mesh.extensions?.[MIRU_MESH_OCCLUDER] != null) {
        object.renderOrder = -1
        ;(object.material as THREE.MeshStandardMaterial).colorWrite = false
      }
    })

    return null
  }
}
