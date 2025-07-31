export { type InteractivityTypeSignature as TypeSignature } from '../../types.ts'

export type InteractivityPropertyType =
  (typeof InteractivityPropertyType)[keyof typeof InteractivityPropertyType]

export const InteractivityPropertyType = {
  INTERACTIVITY: 'Interactivity',
  GRAPH: 'InteractivityGraph',
  TYPE: 'InteractivityType',
  VARIABLE: 'InteractivityVariable',
  EVENT: 'InteractivityEvent',
  DECLARATION: 'InteractivityDeclaration',
  NODE: 'InteractivityNode',
  FLOW: 'InteractivityFlow',
  VALUE: 'InteractivityValue',
  NODE_CONFIG_VALUE: 'InteractivityNodeConfigValue',
} as const
