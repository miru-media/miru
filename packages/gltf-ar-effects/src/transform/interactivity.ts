import * as gltf from '@gltf-transform/core'

import { KHR_INTERACTIVITY } from '../constants'
import {
  type InteractivityGraph,
  type InteractivityValue,
  type InteractivityVariable,
  type KHRInteractivityExtension,
} from '../types'

import { InteractivityGraphReaderContext } from './interactivity-graph-reader-context'
import { InteractivityGraphWriterContext } from './interactivity-graph-writer-context'
import { Declaration } from './properties/declaration'
import { Event } from './properties/event'
import { Flow } from './properties/flow'
import { Graph } from './properties/graph'
import { InteractivityRoot } from './properties/interactivity-root'
import { Node } from './properties/node'
import { Type } from './properties/type'
import { Value } from './properties/value'
import { Variable } from './properties/variable'

const enum ContainerType {
  Variable,
  Value,
}

export class Interactivity extends gltf.Extension {
  static EXTENSION_NAME = KHR_INTERACTIVITY

  extensionName = KHR_INTERACTIVITY

  readonly extensionNodeConfigReferences: Record<
    string,
    Record<string, 'type' | 'variable' | 'event' | 'node'> | undefined
  > = {}

  createRoot(name?: string) {
    return new InteractivityRoot(this.document.getGraph(), name)
  }

  createGraph(name?: string) {
    return new Graph(this.document.getGraph(), name)
  }

  createType(name?: string) {
    return new Type(this.document.getGraph(), name)
  }

  createVariable(name?: string) {
    return new Variable(this.document.getGraph(), name)
  }

  createEvent(name?: string) {
    return new Event(this.document.getGraph(), name)
  }

  createDeclaration(name?: string) {
    return new Declaration(this.document.getGraph(), name)
  }

  createNode(name?: string) {
    return new Node(this.document.getGraph(), name)
  }

  createFlow(node: Node, socket: string, name?: string) {
    return new Flow(this.document.getGraph(), name).setNode(node).setSocket(socket)
  }

  createValue(name?: string) {
    return new Value(this.document.getGraph(), name)
  }

  read(gltfReaderContext: gltf.ReaderContext): this {
    const { json } = gltfReaderContext.jsonDoc
    const interactivityJson = (
      json.extensions as { [KHR_INTERACTIVITY]?: KHRInteractivityExtension } | undefined
    )?.[KHR_INTERACTIVITY]

    if (!interactivityJson) return this

    const setBaseProps = <T extends gltf.Property>(prop: T, json: Partial<gltf.IProperty>) => {
      const { name, extras } = json
      if (extras) prop.setExtras(extras)
      if (name) prop.setName(name)
      return prop
    }

    const root = this.document.getRoot()
    const interactivityRoot = setBaseProps(this.createRoot(), interactivityJson)

    root.setExtension(KHR_INTERACTIVITY, interactivityRoot)

    // graphs
    interactivityJson.graphs.forEach((graphJson, graphIndex) => {
      const graph = setBaseProps(this.createGraph(), graphJson)
      interactivityRoot.addGraph(graph)

      if (graphIndex === interactivityJson.graph) interactivityRoot.setDefaultGraph(graph)

      const context = new InteractivityGraphReaderContext(this)

      const readValueContainerJson = <T extends ContainerType>(
        containerType: T,
        containerJson: InteractivityValue | InteractivityVariable,
      ) => {
        const valueContainer =
          containerType === ContainerType.Value ? new Value(this.document.getGraph()) : this.createVariable()

        return setBaseProps(valueContainer, containerJson)
          .setValueFromJson(containerJson)
          .setType(context.types[containerJson.type]) as T extends ContainerType.Value ? Value : Variable
      }

      // types
      graphJson.types?.forEach((typeJson) => {
        const signature = typeJson.signature
        const type = setBaseProps(this.createType().setSignature(signature), typeJson)
        graph.addType(type)
        context.types.push(type)
      })

      // variables
      graphJson.variables?.forEach((variableJson) => {
        const variable = readValueContainerJson(ContainerType.Variable, variableJson)
        graph.addVariable(variable)
        context.variables.push(variable)
      })

      // events
      graphJson.events?.forEach((eventJson) => {
        const event = setBaseProps(this.createEvent(), eventJson)
        event.setId(eventJson.id ?? null)

        if (eventJson.values)
          Object.entries(eventJson.values).forEach(([id, valueJson]) =>
            event.setValue(id, readValueContainerJson(ContainerType.Value, valueJson)),
          )

        graph.addEvent(event)
        context.events.push(event)
      })

      // declarations
      graphJson.declarations?.forEach((declarationJson) => {
        const declaration = setBaseProps(this.createDeclaration().setOp(declarationJson.op), declarationJson)

        if ('extension' in declarationJson && typeof declarationJson.extension === 'string') {
          Object.entries(declarationJson.inputValueSockets).forEach(([id, { type }]) =>
            declaration.setInputValueSocket(id, context.types[type]),
          )
          Object.entries(declarationJson.outputValueSockets).forEach(([id, { type }]) =>
            declaration.setOutputValueSocket(id, context.types[type]),
          )
        }

        graph.addDeclaration(declaration)
        context.declarations.push(declaration)
      })

      // nodes
      // TODO: sort by output flow socket pointers
      // The node property value MUST be greater than the index of the current node and less then the total number of nodes,
      // otherwise the node is invalid and the graph MUST be rejected. This ensures that flow sockets do not form loops.
      if (graphJson.nodes) {
        for (let nodeIndex = graphJson.nodes.length - 1; nodeIndex >= 0; nodeIndex--) {
          const nodeJson = graphJson.nodes[nodeIndex]
          const node = setBaseProps(this.createNode(), nodeJson).setDeclaration(
            context.declarations[nodeJson.declaration],
          )

          context.nodes[nodeIndex] = node

          // node outflows
          Object.entries(nodeJson.flows ?? {}).forEach(([id, flowJson]) => {
            node.setFlow(id, context.nodes[flowJson.node].createFlow(flowJson.socket))
          })
        }

        graphJson.nodes.forEach((nodeJson, nodeIndex) => {
          const node = context.nodes[nodeIndex]

          // node configuration
          context.readNodeConfigJson(node, nodeJson)

          // node values and input flows
          Object.entries(nodeJson.values ?? {}).forEach(([id, valueJson]) => {
            if ('value' in valueJson)
              node.setValue(id, readValueContainerJson(ContainerType.Value, valueJson))
            if ('node' in valueJson && (valueJson.node as unknown) != null)
              node.setInput(id, context.nodes[valueJson.node].createFlow(valueJson.socket))
          })

          graph.addNode(node)
        })
      }
    })

    return this
  }

  write(gltfWriterContext: gltf.WriterContext): this {
    const { json } = gltfWriterContext.jsonDoc

    const root = this.document.getRoot().getExtension<InteractivityRoot>(KHR_INTERACTIVITY)
    if (!root) return this

    const graphs = root.listGraphs()
    const defaultGraph = root.getDefaultGraph()

    if (defaultGraph && !graphs.includes(defaultGraph)) graphs.push(defaultGraph)

    if (graphs.length === 0) return this

    json.extensions ??= {}
    const result = (json.extensions[KHR_INTERACTIVITY] = {} as KHRInteractivityExtension)

    result.graphs = graphs.map((graph, graphIndex): InteractivityGraph => {
      const context = (gltfWriterContext.extensionData[KHR_INTERACTIVITY] =
        new InteractivityGraphWriterContext(this))

      graph.listTypes().forEach(context.addType.bind(context))
      graph.listVariables().forEach(context.addVariable.bind(context))
      graph.listEvents().forEach(context.addEvent.bind(context))
      graph.listDeclarations().forEach(context.addDeclaration.bind(context))
      graph.listNodes().forEach(context.addNode.bind(context))

      if (graph === defaultGraph) result.graph = graphIndex

      return context.finalize()
    })

    return this
  }
}
