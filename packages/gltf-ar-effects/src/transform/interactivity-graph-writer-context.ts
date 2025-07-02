import type * as gltf from '@gltf-transform/core'

import type {
  InteractivityDeclaration,
  InteractivityEvent,
  InteractivityExtensionDeclaration,
  InteractivityFlow,
  InteractivityGraph,
  InteractivityNode,
  InteractivityType,
  InteractivityValue,
  InteractivityValueLiteral,
  InteractivityVariable,
} from '../types'

import type { Interactivity } from './interactivity'
import type { Declaration } from './properties/declaration'
import { Event } from './properties/event'
import type { Flow } from './properties/flow'
import type { Node } from './properties/node'
import { Type } from './properties/type'
import { Value } from './properties/value'
import { Variable } from './properties/variable'

class PropJsonMap<T, U extends Record<string, any>> {
  private readonly map = new Map<T, { json: U; index: number }>()

  add(prop: T, json: U) {
    const { map } = this
    const entry = map.get(prop)
    if (entry !== undefined) return entry.index

    const index = map.size
    map.set(prop, { json, index })
    return index
  }

  has(prop: T) {
    return this.map.has(prop)
  }

  getIndex(prop: T) {
    return this.map.get(prop)?.index
  }

  finalize() {
    return Array.from(this.map.values()).map(({ json }) => json)
  }
}

const getBaseJson = (prop: gltf.Property) => {
  const json: Partial<gltf.IProperty> = {}

  const name = prop.getName()
  const extras = prop.getExtras()

  if (name) json.name = name
  if (Object.keys(extras).length) json.extras = extras

  return json
}

export class InteractivityGraphWriterContext {
  types = new PropJsonMap<Type, InteractivityType>()
  variables = new PropJsonMap<Variable, InteractivityVariable>()
  events = new PropJsonMap<Event, InteractivityEvent>()
  declarations = new PropJsonMap<Declaration, InteractivityDeclaration>()
  nodes = new PropJsonMap<Node, InteractivityNode>()

  private _intTypeForPropertyIndexValues!: Type

  constructor(private interactivity: Interactivity) {}

  addType(type: Type | null) {
    if (!type) throw new Error('Missing interactivity type definition.')

    if (type.getSignature() === 'int') this._intTypeForPropertyIndexValues = type

    return (
      this.types.getIndex(type) ??
      this.types.add(type, {
        ...(getBaseJson(type) as gltf.IProperty),
        signature: type.getSignature(),
      })
    )
  }

  addVariable(variable: Variable | null) {
    if (!variable) throw new Error('Missing interactivity variable definition.')

    let index = this.variables.getIndex(variable)
    if (index != null) return index

    const json = getBaseJson(variable) as InteractivityVariable

    index = this.variables.add(variable, json)

    json.type = this.addType(variable.getType())
    const value: unknown = variable.getValue()

    if (value != null) json.value = Array.isArray(value) ? value : [value]

    return index
  }

  addEvent(event: Event | null) {
    if (!event) throw new Error('Missing interactivity custom event definition.')

    let index = this.events.getIndex(event)
    if (index != null) return index

    const json = getBaseJson(event) as InteractivityEvent

    index = this.events.add(event, json)

    const id = event.getId()
    if (id != null) json.id = id

    const valueIds = event.listValueIds()
    if (valueIds.length) {
      const values = (json.values ??= {})
      valueIds.forEach((id) => {
        const valueJson = this.toJsonValue(event.getValue(id)!)
        if (valueJson) values[id] = valueJson
      })
    }

    return index
  }

  addDeclaration(declaration: Declaration | null) {
    if (!declaration) throw new Error('Missing interactivity declaration definition.')

    let index = this.declarations.getIndex(declaration)

    if (index != null) return index

    const op = declaration.getOp()
    const extensionName = declaration.getExtensionName()
    const json: InteractivityDeclaration = { op, ...getBaseJson(declaration) }
    index = this.declarations.add(declaration, json)

    if (extensionName) {
      const extendedJson = json as InteractivityExtensionDeclaration
      const inputIds = declaration.listInputValueSocketIds()
      const outputIds = declaration.listInputValueSocketIds()

      extendedJson.extension = extensionName

      if (inputIds.length) {
        extendedJson.inputValueSockets = Object.fromEntries(
          inputIds.map((id) => [id, { type: this.addType(declaration.getInputValueSocket(id)) }]),
        )
      }
      if (outputIds.length) {
        extendedJson.inputValueSockets = Object.fromEntries(
          outputIds.map((id) => [id, { type: this.addType(declaration.getInputValueSocket(id)) }]),
        )
      }
    }

    return index
  }

  addNode(node: Node | null) {
    if (!node) throw new Error('Missing interactivity node definition.')

    let index = this.nodes.getIndex(node)
    if (index != null) return index

    const json = getBaseJson(node) as InteractivityNode
    index = this.nodes.add(node, json)

    const declaration = node.getDeclaration()

    json.declaration = this.addDeclaration(declaration)

    // values
    const valueIds = node.listValueIds()

    if (valueIds.length) {
      const values = (json.values ??= {})

      valueIds.forEach((id) => {
        const jsonValue = this.toJsonValue(node.getValue(id)!)
        if (jsonValue) values[id] = jsonValue
      })
    }

    // inputs from other node sockets
    const inputIds = node.listInputIds()

    if (inputIds.length) {
      const values = (json.values ??= {})
      inputIds.forEach((id) => (values[id] = this.serializeFlow(node.getInput(id)!)))
    }

    // flows out to other nodes
    const flowIds = node.listFlowIds()

    if (flowIds.length) {
      const flows = (json.flows ??= {})
      flowIds.forEach((id) => (flows[id] = this.serializeFlow(node.getFlow(id)!)))
    }

    // configuration
    this.writeNodeConfigJson(node, json)

    return index
  }

  serializeFlow(flow: Flow) {
    return { node: this.addNode(flow.getNode()), socket: flow.getSocket() }
  }

  writeNodeConfigJson(node: Node, json: InteractivityNode) {
    const configIds = node.listConfigIds()

    if (configIds.length) {
      const configuration = (json.configuration ??= {})

      configIds.forEach((id) => {
        const prop = node.getConfig(id)!
        const serialized = this.toValueLiteralJson(prop)
        if (serialized) configuration[id] = { value: serialized }
      })
    }
  }

  toJsonValue(source: Value | Type): InteractivityValue | null
  toJsonValue(source: Flow): InteractivityFlow | null
  toJsonValue(source: Value | Flow | Type): InteractivityValue | InteractivityFlow | null {
    const type = this.addType(
      source instanceof Value ? source.getType() : this._intTypeForPropertyIndexValues,
    )
    let value: InteractivityValueLiteral | null

    if (source instanceof Value) {
      value = source.serializeAsJson()
      if (value == null) return null
    } else if (source instanceof Variable) value = [this.addVariable(source)]
    else if (source instanceof Type) value = [this.addType(source)]
    else value = [this.addNode(source.getNode())]

    return { value, type }
  }

  toValueLiteralJson(source: Type | Value | Variable | Event | Node) {
    if (source instanceof Value) return source.serializeAsJson()

    return [
      source instanceof Type
        ? this.addType(source)
        : source instanceof Variable
          ? this.addVariable(source)
          : source instanceof Event
            ? this.addEvent(source)
            : this.addNode(source),
    ]
  }

  finalize() {
    // @ts-expect-error -- cleanup
    this.interactivity = undefined

    const result: InteractivityGraph = {}

    const types = this.types.finalize()
    const variables = this.variables.finalize()
    const events = this.events.finalize()
    const declarations = this.declarations.finalize()
    const nodes = this.nodes.finalize()

    if (types.length) result.types = types
    if (variables.length) result.variables = variables
    if (events.length) result.events = events
    if (declarations.length) result.declarations = declarations
    if (nodes.length) result.nodes = nodes

    return result
  }
}
