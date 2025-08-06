import * as Behave from '@behave-graph/core'
import * as THREE from 'three'
import type { GLTFLoaderPlugin, GLTFParser, GLTFReference } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { KHR_INTERACTIVITY } from '../../../constants.ts'
import type { KHRInteractivityExtension } from '../../../types.ts'

import { registerNodes } from './behave-nodes.ts'
import { convertGraph } from './convert-graph.ts'
import { CustomRegistry } from './custom-registry.ts'
import { TYPES } from './value-types.ts'

declare module 'three/examples/jsm/loaders/GLTFLoader.d.ts' {
  export interface GLTFReference {
    primitives?: number
  }
}

interface JsonWithInteractivity {
  extensions?: { KHR_interactivity?: KHRInteractivityExtension }
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

  get json(): JsonWithInteractivity {
    return this.parser.json
  }

  constructor(parser: GLTFParser) {
    this.parser = parser
  }

  afterRoot(): null | Promise<void> {
    const interactivityExtension = this.json.extensions?.KHR_interactivity

    this.parser.associations.forEach((reference, object) => {
      if (!(reference as GLTFReference | undefined)) return null

      if (reference.nodes != null && object instanceof THREE.Object3D)
        this.objectArrays.nodes[reference.nodes] = object
      if (reference.materials != null && object instanceof THREE.Material)
        this.objectArrays.materials[reference.materials] = object
      if (reference.meshes != null && (object instanceof THREE.Mesh || object instanceof THREE.Group)) {
        this.objectArrays.meshes[reference.meshes] = object
      }
      // TODO: other object types
    })

    const graphJson =
      interactivityExtension?.graph != null && interactivityExtension.graphs
        ? interactivityExtension.graphs[interactivityExtension.graph]
        : {}

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

  setProperty(path: string[], value: unknown): void {
    switch (path[0]) {
      case 'nodes': {
        const threeObject = this.objectArrays.nodes[parseInt(path[1], 10)] as THREE.Object3D | undefined

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
          case 'extensions':
            switch (path[3]) {
              case 'KHR_node_visibility': {
                if (path[4] === 'visible') threeObject.visible = value as boolean
              }
            }
            break
        }

        break
      }
    }
  }

  triggerCustomFlows(op: string, updateValues: any, filter = (_node: Behave.Node) => true): void {
    const nodes = Object.values(this.engine.graph.nodes).filter(
      (node): node is Behave.FlowNode => node.description.typeName === op && filter(node),
    )

    nodes.forEach((node) => {
      Object.keys(updateValues).forEach((key) => node.writeOutput(`value:${key}`, updateValues[key]))
    })
  }

  emitCustomEvent(id: number | string, parameters: Record<string, unknown>): void {
    this.emit('event/receive', parameters, (node) => node.configuration.customEventId === id)
  }

  emit(
    op: string,
    emittedValues: any,
    filter = (_node: Behave.EventNode) => true,
    sockets: string[] = ['out'],
  ): void {
    const eventNodes = this.engine.eventNodes.filter(
      (node) => node.description.typeName === op && filter(node),
    )

    eventNodes.forEach((eventNode) => {
      Object.keys(emittedValues).forEach((key) => eventNode.writeOutput(`value:${key}`, emittedValues[key]))
      sockets.forEach((id) => this.engine.commitToNewFiber(eventNode, `flow:${id}`))
    })

    this.engine.executeAllSync()
  }

  dispose(): void {
    this.engine.dispose()
  }
}
