import * as Behave from '@behave-graph/core'
import jsonPointer from 'json-pointer'

import { type CustomRegistry } from './CustomRegistry'

export class EventReceive extends Behave.EventNode {
  static Description = new Behave.NodeDescription(
    `event/receive`,
    'Action',
    `event/receive`,
    (description, graph, config) => new EventReceive(description, graph, config),
  )

  constructor(description: Behave.NodeDescription, graph: Behave.Graph, config: Behave.NodeConfiguration) {
    const customEvent = graph.customEvents[config.customEventId as number]

    const inputs: Behave.Socket[] = []
    const outputs: Behave.Socket[] = [
      new Behave.Socket('flow', 'flow:out', undefined, `${description.label} ${customEvent.id} flow out`),
    ]

    const valueSockets = customEvent.parameters.map(
      (s) => new Behave.Socket(s.valueTypeName, s.name, s.value, s.label, s.valueChoices),
    )

    outputs.push(...valueSockets)

    super(description, graph, inputs, outputs, config)
  }

  init(_engine: Behave.Engine): void {
    // noop
  }
}

export class EventSend extends Behave.FlowNode {
  static Description = new Behave.NodeDescription(
    `event/send`,
    'Action',
    `event/send`,
    (description, graph, config) => new EventSend(description, graph, config),
  )
  private customEvent: Behave.CustomEvent

  constructor(description: Behave.NodeDescription, graph: Behave.Graph, config: Behave.NodeConfiguration) {
    const customEvent = graph.customEvents[config.customEventId as number]

    const inputs: Behave.Socket[] = []
    const outputs: Behave.Socket[] = [
      new Behave.Socket('flow', 'flow:out', undefined, `${description.label} ${customEvent.id} flow out`),
    ]

    const valueSockets = customEvent.parameters.map(
      (s) => new Behave.Socket(s.valueTypeName, s.name, s.value, s.label, s.valueChoices),
    )

    inputs.push(
      new Behave.Socket('flow', 'flow:in', undefined, `${description.label} ${customEvent.id} flow in`),
      ...valueSockets,
    )

    super(description, graph, inputs, outputs, config)

    this.customEvent = customEvent
  }

  triggered(): void {
    const event = Object.fromEntries(
      this.customEvent.parameters.map((socket) => [socket.name, this.readInput(socket.name)]),
    )
    this.customEvent.eventEmitter.emit(event)
  }
}

export class PropertySetNode extends Behave.FlowNode {
  static Description = new Behave.NodeDescription(
    'pointer/set',
    'Action',
    'pointer/set',
    (description, graph, config) => new PropertySetNode(description, graph, config),
    undefined,
    'Set a property of an object',
  )

  pathGetters: (() => unknown)[]

  constructor(description: Behave.NodeDescription, graph: Behave.Graph, config: Behave.NodeConfiguration) {
    const { pointer, type } = config as { pointer: string; type: number }

    const path = jsonPointer.parse(pointer)
    const templateInputSockets: Behave.Socket[] = []

    // TODO: reject invalid pointers
    const pathGetters = path.map((segment) => {
      if (segment.startsWith('{')) {
        const name = segment.slice(1, segment.length - 1)

        if (segment[1] === '{' && segment.endsWith('}}')) return () => name
        else if (segment.endsWith('}')) {
          const socketName = `value:${name}`
          templateInputSockets.push(new Behave.Socket('int', socketName, 0))
          return () => this.readInput<string>(socketName)
        }

        throw new Error(`Invalid pointer template "${pointer}"`)
      }
      return () => segment
    })

    const inputValueSocket = new Behave.Socket(
      (graph.registry as CustomRegistry).env.getTypeName(type),
      'value:value',
      undefined,
      `${description.label} input value`,
    )

    super(
      description,
      graph,
      [
        new Behave.Socket('flow', 'flow:in', undefined, `${description.label} in`),
        ...templateInputSockets,
        inputValueSocket,
      ],
      [new Behave.Socket('flow', 'flow:out', undefined, `${description.label} out`)],
      config,
    )

    this.pathGetters = pathGetters
  }
  triggered(fiber: Behave.Fiber): void {
    ;(this.graph.registry as CustomRegistry).env.setProperty(
      this.pathGetters.map((s) => String(s())),
      this.readInput('value:value'),
    )
    fiber.commit(this, 'flow:out')
  }
}

export const registerNodes = (registry: CustomRegistry) => {
  registry.nodes.register(EventReceive.Description, EventSend.Description, PropertySetNode.Description)
}
