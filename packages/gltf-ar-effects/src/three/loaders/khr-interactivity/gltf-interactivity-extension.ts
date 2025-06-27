import * as Behave from '@behave-graph/core'
import * as THREE from 'three'
import {
  type GLTFLoaderPlugin,
  type GLTFParser,
  type GLTFReference,
} from 'three/examples/jsm/loaders/GLTFLoader.js'

import { KHR_INTERACTIVITY } from '../../../constants'
import { type KHRInteractivityExtension } from '../../../types'

import { registerNodes } from './behave-nodes'
import { convertGraph } from './convert-graph'
import { CustomRegistry } from './custom-registry'
import { TYPES } from './value-types'

declare module 'three/examples/jsm/loaders/GLTFLoader.d.ts' {
  export interface GLTFReference {
    primitives?: number
  }
}

export class GLTFInteractivityExtension implements GLTFLoaderPlugin {
  name: typeof KHR_INTERACTIVITY = KHR_INTERACTIVITY
  parser!: GLTFParser

  registry = new CustomRegistry({
    getTypeName: (typeIndex: number) => this.typeNames[typeIndex],
    setProperty: this.setProperty.bind(this),
  })

  typeNames: string[] = []
  engine!: Behave.Engine

  objectArrays = {
    nodes: [] as THREE.Object3D[],
    materials: [] as THREE.Material[],
    meshes: [] as (THREE.Group | THREE.Mesh)[],
  } satisfies Record<string, THREE.Object3D[] | THREE.Material[]>

  get json() {
    return this.parser.json as {
      extensions?: { KHR_interactivity?: KHRInteractivityExtension }
    }
  }

  init(parser: GLTFParser) {
    this.parser = parser
    return this
  }

  afterRoot() {
    const interactivityExtension = this.json.extensions?.KHR_interactivity

    if (interactivityExtension?.graph == undefined) return null

    this.parser.associations.forEach((reference, object) => {
      if (!(reference as GLTFReference | undefined)) return

      if (reference.nodes != null && object instanceof THREE.Object3D)
        this.objectArrays.nodes[reference.nodes] = object
      if (reference.materials != null && object instanceof THREE.Material)
        this.objectArrays.materials[reference.materials] = object
      if (reference.meshes != null && (object instanceof THREE.Mesh || object instanceof THREE.Group)) {
        this.objectArrays.meshes[reference.meshes] = object
      }
      // TODO: other object types
    })

    const graphJson = interactivityExtension.graphs[interactivityExtension.graph]

    this.typeNames.push(...(graphJson.types?.map((t) => t.signature) ?? []))

    const { registry } = this
    registerNodes(registry)

    registry.values.register(
      ...(graphJson.types ?? []).map((type) => (TYPES as Record<string, Behave.ValueType>)[type.signature]),
    )

    const graph = Behave.readGraphFromJSON(convertGraph(graphJson), registry)
    this.engine = new Behave.Engine(graph)

    return null
  }

  setProperty(path: string[], value: unknown) {
    switch (path[0]) {
      case 'nodes': {
        const threeObject = this.objectArrays.nodes.at(parseInt(path[1], 10))

        if (!threeObject) return

        switch (path[2]) {
          case 'translation':
            threeObject.position.fromArray(value as number[])
            break
          case 'rotation':
            threeObject.quaternion.fromArray(value as number[])
            break
          case 'scale':
            threeObject.scale.fromArray(value as number[])
            break
        }

        break
      }
    }
  }

  emitCustomEvent(id: number | string, parameters: Record<string, unknown>) {
    this.engine.graph.customEvents[id].eventEmitter.emit(parameters)
  }

  emit(op: string, emittedValues: any, filter = (_nodes: Behave.EventNode) => true) {
    const eventNodes = this.engine.eventNodes.filter(
      (node) => node.description.typeName === op && filter(node),
    )

    eventNodes.forEach((eventNode) => {
      Object.keys(emittedValues).forEach((key) => {
        eventNode.writeOutput(`value:${key}`, emittedValues[key])
      })
    })

    eventNodes.forEach((eventNode) => this.engine.commitToNewFiber(eventNode, `flow:out`))

    this.engine.executeAllSync()
  }
}
