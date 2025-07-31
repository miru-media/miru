import * as gltf from '@gltf-transform/core'

import { KHR_INTERACTIVITY } from '../../constants.ts'

import type { Graph } from './graph.ts'
import { InteractivityPropertyType } from './property-types.ts'
import type { Type } from './type.ts'

export class InteractivityRoot extends gltf.ExtensionProperty<{
  name: string
  extras: Record<string, unknown>
  graphs: gltf.RefSet<Graph>
  graph: Graph
}> {
  static EXTENSION_NAME = KHR_INTERACTIVITY
  declare extensionName: string
  declare propertyType: string
  declare parentTypes: string[]

  types: Type[] = []

  init() {
    this.extensionName = KHR_INTERACTIVITY
    this.propertyType = InteractivityPropertyType.INTERACTIVITY
    this.parentTypes = [gltf.PropertyType.ROOT]
  }

  getDefaults() {
    return Object.assign(super.getDefaults(), { graphs: new gltf.RefList() })
  }

  addGraph(graph: Graph) {
    return this.addRef('graphs', graph)
  }
  removeGraph(graph: Graph) {
    return this.removeRef('graphs', graph)
  }
  listGraphs() {
    return this.listRefs('graphs')
  }

  setDefaultGraph(graph: Graph) {
    return this.setRef('graph', graph)
  }
  getDefaultGraph() {
    return this.getRef('graph')
  }
}
