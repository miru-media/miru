import { type ValueType } from '@behave-graph/core'

import { lerp } from 'shared/utils/math'

const identity = <T>(value: T) => value
const invalid = () => {
  throw new Error('Invalid')
}

export const bool: ValueType<boolean> = {
  name: 'bool',
  creator: () => false,
  deserialize: identity,
  serialize: identity,
  lerp: invalid,
}

export const float = {
  name: 'float',
  creator: () => NaN,
  deserialize: identity,
  serialize: identity,
  lerp: lerp,
}

export const float2: ValueType<[number, number]> = {
  name: 'float2',
  creator: () => [NaN, NaN],
  deserialize: identity,
  serialize: identity,
  lerp: (start, end, t) => {
    return [lerp(start[0], end[0], t), lerp(start[1], end[1], t)]
  },
}

export const float3: ValueType<[number, number, number]> = {
  name: 'float3',
  creator: () => [NaN, NaN, NaN],
  deserialize: identity,
  serialize: identity,
  lerp: (start, end, t) => {
    return [lerp(start[0], end[0], t), lerp(start[1], end[1], t), lerp(start[2], end[2], t)]
  },
}

export const float4: ValueType<[number, number, number, number]> = {
  name: 'float4',
  creator: () => [NaN, NaN, NaN, NaN],
  deserialize: identity,
  serialize: identity,
  lerp: (start, end, t) => {
    return [
      lerp(start[0], end[0], t),
      lerp(start[1], end[1], t),
      lerp(start[2], end[2], t),
      lerp(start[3], end[3], t),
    ]
  },
}

export const float2x2 = {
  name: 'float2x2',
  creator: () => [NaN, NaN, NaN, NaN],
  deserialize: identity,
  serialize: identity,
  lerp: invalid,
}

export const float3x3 = {
  name: 'float3x3',
  creator: () => [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
  deserialize: identity,
  serialize: identity,
  lerp: invalid,
}

export const float4x4 = {
  name: 'float4x4',
  creator: () => [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
  deserialize: identity,
  serialize: identity,
  lerp: invalid,
}

export const int: ValueType<number> = {
  name: 'int',
  creator: () => 0,
  deserialize: identity,
  serialize: identity,
  lerp: invalid,
}

export const custom = {
  name: 'custom',
  creator: () => undefined as never,
  deserialize: identity,
  serialize: identity,
  lerp: invalid,
}

export const TYPES = {
  bool,
  float,
  float2,
  float3,
  float4,
  float2x2,
  float3x3,
  float4x4,
  int,
  custom,
}
