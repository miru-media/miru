import * as gltf from '@gltf-transform/core'

import type { MaybeArray } from 'shared/types'

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
} from '../types.ts'

import type { Declaration } from './properties/declaration.ts'
import { Event } from './properties/event.ts'
import { Flow } from './properties/flow.ts'
import { LiteralValue } from './properties/literal-value.ts'
import type { LiteralOrPropertyValue } from './properties/node-config-value.ts'
import type { Node } from './properties/node.ts'
import { Type } from './properties/type.ts'
import { Variable } from './properties/variable.ts'
import { isSingleLiteral } from './utils.ts'

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

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- used for return type
const getBaseJson = <T>(prop: gltf.Property): T => {
  const json: Partial<gltf.IProperty> = {}

  const name = prop.getName()
  const extras = prop.getExtras()

  if (name) json.name = name
  if (Object.keys(extras).length) json.extras = extras

  return json as T
}

export class InteractivityGraphWriterContext {
  private document: gltf.Document
  types = new PropJsonMap<Type, InteractivityType>()
  variables = new PropJsonMap<Variable, InteractivityVariable>()
  events = new PropJsonMap<Event, InteractivityEvent>()
  declarations = new PropJsonMap<Declaration, InteractivityDeclaration>()
  nodes = new PropJsonMap<Node, InteractivityNode>()

  private _intTypeForPropertyIndexValues!: Type

  constructor(document: gltf.Document) {
    this.document = document
  }

  addType(type: Type | null): number {
    if (!type) throw new Error('Missing interactivity type definition.')

    if (type.getSignature() === 'int') this._intTypeForPropertyIndexValues = type

    return (
      this.types.getIndex(type) ??
      this.types.add(type, {
        ...getBaseJson<gltf.IProperty>(type),
        signature: type.getSignature(),
      })
    )
  }

  addVariable(variable: Variable | null): number {
    if (!variable) throw new Error('Missing interactivity variable definition.')

    let index = this.variables.getIndex(variable)
    if (index != null) return index

    const json = getBaseJson<InteractivityVariable>(variable)

    index = this.variables.add(variable, json)

    json.type = this.addType(variable.getType())
    const value: unknown = variable.getValue()

    if (value != null) json.value = Array.isArray(value) ? value : [value]

    return index
  }

  addEvent(event: Event | null): number {
    if (!event) throw new Error('Missing interactivity custom event definition.')

    let index = this.events.getIndex(event)
    if (index != null) return index

    const json = getBaseJson<InteractivityEvent>(event)

    index = this.events.add(event, json)

    const id = event.getId()
    if (id != null) json.id = id

    const valueIds = event.listValueIds()
    if (valueIds.length) {
      const values = (json.values ??= {})
      valueIds.forEach((id) => {
        const valueJson = this.toJsonValue(event.getValue(id))
        if (valueJson) values[id] = valueJson
      })
    }

    return index
  }

  addDeclaration(declaration: Declaration | null): number {
    if (!declaration) throw new Error('Missing interactivity declaration definition.')

    let index = this.declarations.getIndex(declaration)

    if (index != null) return index

    const op = declaration.getOp()
    const extensionName = declaration.getExtensionName()
    const json = { ...getBaseJson<InteractivityDeclaration>(declaration), op }
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

  addNode(node: Node | null): number {
    if (!node) throw new Error('Missing interactivity node definition.')

    let index = this.nodes.getIndex(node)
    if (index != null) return index

    const json = getBaseJson<InteractivityNode>(node)
    index = this.nodes.add(node, json)

    const declaration = node.getDeclaration()

    json.declaration = this.addDeclaration(declaration)

    // values
    const valueIds = node.listValueIds()

    if (valueIds.length) {
      const values = (json.values ??= {})

      valueIds.forEach((id) => {
        const value = node.getValue(id)
        const jsonValue = this.toJsonValue(value)
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

  serializeFlow(flow: Flow): InteractivityFlow {
    return { node: this.addNode(flow.getNode()), socket: flow.getSocket() }
  }

  writeNodeConfigJson(node: Node, json: InteractivityNode): void {
    const configIds = node.listConfigIds()

    if (configIds.length) {
      const configuration = (json.configuration ??= {})

      configIds.forEach((id) => {
        const prop = node.getConfig(id)!
        const serialized = this.toValueLiteralJson(prop)
        if (serialized != null) configuration[id] = { value: [serialized as any] }
      })
    }
  }

  toJsonValue(source: Type | Variable | Event | Node | gltf.Node): InteractivityValue
  toJsonValue(source: LiteralValue | null): InteractivityValue | null
  toJsonValue(source: Flow | null): InteractivityFlow
  toJsonValue(
    source: Type | Variable | Event | Node | LiteralValue | Flow | gltf.Node | null,
  ): InteractivityValue | InteractivityFlow | null
  toJsonValue(
    source: Type | Variable | Event | Node | LiteralValue | Flow | gltf.Node | null,
  ): InteractivityValue | InteractivityFlow | null {
    if (source == null) return null

    const type = this.addType(
      source instanceof LiteralValue ? source.getType() : this._intTypeForPropertyIndexValues,
    )
    let value: InteractivityValueLiteral | null

    if (source instanceof LiteralValue) {
      value = source.serializeAsJson()
      if (value == null) return null
    } else if (source instanceof gltf.Node) {
      value = [this.document.getRoot().listNodes().indexOf(source)]
    } else if (source instanceof Flow) value = [this.addNode(source.getNode())]
    else value = [this.getPropertyIndex(source)]

    return { value, type }
  }

  getPropertyIndex(property: Type | Variable | Event | Node) {
    return property instanceof Type
      ? this.addType(property)
      : property instanceof Variable
        ? this.addVariable(property)
        : property instanceof Event
          ? this.addEvent(property)
          : this.addNode(property)
  }

  toValueLiteralJson(source: MaybeArray<LiteralOrPropertyValue> | null): unknown {
    if (source == null) return null
    if (isSingleLiteral(source)) return source
    if (source instanceof LiteralValue) return source.getValue()

    if (Array.isArray(source)) {
      return source.map((v) => {
        if (isSingleLiteral(v)) return v
        return this.toValueLiteralJson(v)
      })
    }

    if (source instanceof Flow) throw new Error('Unexpected Flow')

    return this.getPropertyIndex(source)
  }

  finalize(): InteractivityGraph {
    this.document = undefined as never

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
