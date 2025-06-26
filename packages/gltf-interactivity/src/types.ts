export interface KHRInteractivityExtension {
  graphs: InteractivityGraph[]
  graph?: number
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export interface InteractivityGraph {
  types?: InteractivityType[]
  variables?: InteractivityVariable[]
  events?: InteractivityEvent[]
  declarations?: InteractivityDeclaration[]
  nodes?: InteractivityNode[]
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export type InteractivityTypeSignature =
  | 'bool'
  | 'float'
  | 'float2'
  | 'float3'
  | 'float4'
  | 'float2x2'
  | 'float3x3'
  | 'float4x4'
  | 'int'
  | 'custom'

export interface InteractivityType {
  signature: InteractivityTypeSignature
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export type InteractivityValueLiteral = boolean[] | number[] | string[] | null[]

export interface InteractivityValue {
  value?: InteractivityValueLiteral
  type: number
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export interface InteractivityVariable {
  value?: InteractivityValueLiteral
  type: number
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export interface InteractivityEvent {
  id?: string
  values?: Record<string, InteractivityValue>
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export interface InteractivityStandardDeclaration {
  op: string
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export interface InteractivityExtensionDeclaration {
  op: string
  extension: string
  inputValueSockets: Record<string, { type: number }>
  outputValueSockets: Record<string, { type: number }>
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export type InteractivityDeclaration = InteractivityStandardDeclaration | InteractivityExtensionDeclaration

export interface InteractivityNode {
  declaration: number
  configuration?: InteractivityConfiguration
  flows?: Record<string, InteractivityFlow>
  values?: Record<string, InteractivityValue | InteractivityFlow>
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export type InteractivityConfiguration = Partial<Record<string, { value?: InteractivityValueLiteral }>>

export interface InteractivityFlow {
  node: number
  socket?: string
  name?: string
  extras?: Record<string, unknown>
  extensions?: Record<string, unknown>
}
