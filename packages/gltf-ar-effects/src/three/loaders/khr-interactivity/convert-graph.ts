import type * as Behave from '@behave-graph/core'

import type {
  InteractivityGraph,
  InteractivityType,
  InteractivityValue,
  InteractivityVariable,
} from '../../../types'

import { TYPES } from './value-types'

type BehaveMetadata = Record<string, string>

const getValue = (valueJson: InteractivityValue | InteractivityVariable, types: InteractivityType[]) => {
  let value = valueJson.value as typeof valueJson.value | Behave.ValueJSON | null

  // values are always arrays
  if (Array.isArray(value) && value.length === 1) value = value[0]
  // get initial value depending on type
  if (value == null) return TYPES[types[valueJson.type].signature].creator()

  return value as Behave.ValueJSON
}

/**
 * Convert KHR_interactivity draft graph json to a behave-graph json object.
 *
 *  - Prefix socket ids with 'flow' or 'value' to differentiate the socket kinds.
 *  - Use implicit "value", "in" and "out" socket ids.
 *  - Use custom event index as id when id is undefined.
 *  - Change `{ event: { value [0] }} ` custom event config to `{ customEventId: idOrIndex }`
 */
export const convertGraph = (graphJson: InteractivityGraph): Behave.GraphJSON => {
  const singleElementTypeRe = /^(int|float|bool)$/
  const { types = [] } = graphJson

  const readValue = (valueJson: InteractivityValue) => {
    const value = singleElementTypeRe.test(types[valueJson.type].signature)
      ? valueJson.value?.[0]
      : valueJson.value

    return { value: value as Behave.ValueJSON }
  }

  const variables = graphJson.variables?.map(
    (variable, i): Behave.VariableJSON => ({
      id: i.toString(10),
      name: variable.name ?? '',
      valueTypeName: types[variable.type].signature,
      initialValue: getValue(variable, types),
      metadata: variable.extras as BehaveMetadata,
    }),
  )

  const customEvents = graphJson.events?.map(
    (event, index): Behave.CustomEventJSON => ({
      label: undefined,
      id: event.id ?? index.toString(10),
      name: event.name ?? '',
      parameters: Object.entries(event.values ?? {}).map(
        ([id, value]): Behave.CustomEventParameterJSON => ({
          name: `value:${id}`,
          valueTypeName: types[value.type].signature,
          defaultValue: getValue(value, types),
        }),
      ),
      metadata: event.extras as BehaveMetadata,
    }),
  )

  const nodes = graphJson.nodes?.map((node, index) => {
    const declaration = graphJson.declarations![node.declaration]
    const nodeConfig = node.configuration
    const { op } = declaration

    const configuration: Behave.NodeConfigurationJSON = {}

    Object.entries(nodeConfig ?? {}).forEach(([id, valueJson]) => {
      const value = valueJson?.value
      if (value != null) configuration[id] = (value.length === 1 ? value[0] : value) as Behave.ValueJSON
    })

    if (op === 'event/receive' || op === 'event/send') {
      configuration.customEventId = customEvents![configuration.event as number].id
    }

    const nodeJson: Behave.NodeJSON = {
      ...node,
      type: op,
      id: index.toString(10),
      label: undefined,
      configuration,
      parameters: Object.fromEntries(
        Object.entries(node.values ?? {}).map(([key, valueJson]): [string, Behave.NodeParameterJSON] => [
          `value:${key}`,
          !('node' in valueJson) || (valueJson.node as unknown) == null
            ? readValue(valueJson as InteractivityValue)
            : {
                link: { nodeId: valueJson.node.toString(10), socket: `value:${valueJson.socket ?? 'value'}` },
              },
        ]),
      ),
      flows: Object.fromEntries(
        Object.entries(node.flows ?? {}).map(([name, flow]): [string, Behave.LinkJSON] => [
          `flow:${name}`,
          {
            nodeId: flow.node.toString(10),
            socket: `flow:${flow.socket ?? 'in'}`,
          },
        ]),
      ),
      metadata: node.extras as BehaveMetadata,
    }

    return nodeJson
  })

  return {
    name: graphJson.name,
    nodes,
    variables,
    customEvents,
    metadata: graphJson.extras as BehaveMetadata,
  }
}
