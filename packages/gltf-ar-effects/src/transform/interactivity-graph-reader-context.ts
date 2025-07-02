import type { InteractivityNode } from '../types'

import type { Interactivity } from './interactivity'
import type { Declaration } from './properties/declaration'
import type { Event } from './properties/event'
import type { Node } from './properties/node'
import type { Type } from './properties/type'
import { Value } from './properties/value'
import type { Variable } from './properties/variable'

export class InteractivityGraphReaderContext {
  types: Type[] = []
  variables: Variable[] = []
  events: Event[] = []
  declarations: Declaration[] = []
  nodes: Node[] = []

  constructor(private readonly interactivity: Interactivity) {}

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
