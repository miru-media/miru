import type { InteractivityNode } from '../types.ts'

import type { Interactivity } from './interactivity.ts'
import type { Declaration } from './properties/declaration.ts'
import type { Event } from './properties/event.ts'
import { LiteralValue } from './properties/literal-value.ts'
import type { Node } from './properties/node.ts'
import type { Type } from './properties/type.ts'
import type { Variable } from './properties/variable.ts'

export class InteractivityGraphReaderContext {
  private readonly interactivity: Interactivity
  types: Type[] = []
  variables: Variable[] = []
  events: Event[] = []
  declarations: Declaration[] = []
  nodes: Node[] = []

  constructor(interactivity: Interactivity) {
    this.interactivity = interactivity
  }

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
      else node.setConfig(id, new LiteralValue(node.getGraph()).setValueFromJson(valueJson))
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
