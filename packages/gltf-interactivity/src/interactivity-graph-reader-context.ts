import { type Declaration } from './declaration'
import { type Event } from './event'
import { type Interactivity } from './interactivity'
import { type Node } from './node'
import { type Type } from './type'
import { type InteractivityNode } from './types'
import { Value } from './value'
import { type Variable } from './variable'

export class InteractivityGraphReaderContext {
  types: Type[] = []
  variables: Variable[] = []
  events: Event[] = []
  declarations: Declaration[] = []
  nodes: Node[] = []

  constructor(private interactivity: Interactivity) {}

  readNodeConfigJson(node: Node, json: InteractivityNode): void {
    const config = json.configuration
    if (!config) return

    const declaration = this.declarations[json.declaration]
    const op = declaration.getOp()
    const configReferenceTypes =
      standardNodeConfigReferences[op] ?? this.interactivity.extensionNodeConfigReferences[op]

    Object.entries(config).forEach(([id, valueJson]) => {
      const typeName = configReferenceTypes?.[id]
      if (typeName) node.setConfig(id, this[`${typeName}s`][valueJson?.value?.[0] as number])
      else node.setConfig(id, new Value(node.getGraph()).setValueFromJson(valueJson))
    })
  }
}

const standardNodeConfigReferences: Record<
  string,
  Record<string, 'type' | 'variable' | 'event' | 'node'> | undefined
> = {
  'event/receive': { event: 'event' },
  'event/send': { event: 'event' },
  'pointer/get': { pointer: 'type' },
}
