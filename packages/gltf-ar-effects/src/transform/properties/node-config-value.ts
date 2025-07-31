import * as gltf from '@gltf-transform/core'

import type { MaybeArray } from 'shared/types'

import { isSingleLiteral } from '../utils.ts'

import type { Event } from './event.ts'
import type { Flow } from './flow.ts'
import {
  type IInteractivityGraphProperty,
  InteractivityGraphProperty,
} from './interactivity-graph-property.ts'
import type { Node } from './node.ts'
import { InteractivityPropertyType } from './property-types.ts'
import type { Type } from './type.ts'
import type { Variable } from './variable.ts'

type PropertyValueType = Type | Variable | Event | Node | Flow
type LiteralValueType = string | number | boolean

export type LiteralOrPropertyValue = PropertyValueType | LiteralValueType

type ValueType = (typeof ValueType)[keyof typeof ValueType]

const ValueType = {
  Ref: 0,
  Literal: 1,
  Array: 2,
} as const

export interface INodeConfigValue extends IInteractivityGraphProperty {
  valueType: ValueType

  literalValue: LiteralValueType
  refValue: PropertyValueType
  // Use a RefSet of NodeConfigValues to store an array value which may hold literals or properties
  arrayValue: gltf.RefSet<NodeConfigValue>
}

export class NodeConfigValue extends InteractivityGraphProperty<INodeConfigValue> {
  init(): void {
    this.propertyType = InteractivityPropertyType.NODE_CONFIG_VALUE
  }

  getDefaults() {
    return Object.assign(super.getDefaults(), {
      valueType: ValueType.Literal,
      arrayValue: new gltf.RefSet(),
    })
  }

  setValue(value: MaybeArray<LiteralOrPropertyValue>): this {
    switch (this.get('valueType')) {
      case ValueType.Literal:
        this.set('literalValue', null as never)
        break
      case ValueType.Ref:
        this.setRef('refValue', null)
        break
      case ValueType.Array:
        this.listRefs('arrayValue').forEach((item) => this.removeRef('arrayValue', item))
    }

    if (isSingleLiteral(value)) {
      this.set('literalValue', value)
      this.set('valueType', ValueType.Literal)
    } else if (Array.isArray(value)) {
      value.forEach((item) => this.addRef('arrayValue', new NodeConfigValue(this.graph).setValue(item)))
      this.set('valueType', ValueType.Array)
    } else {
      this.setRef('refValue', value)
      this.set('valueType', ValueType.Ref)
    }

    return this
  }

  getValue(): MaybeArray<LiteralOrPropertyValue> {
    switch (this.get('valueType')) {
      case ValueType.Literal:
        return this.get('literalValue')
      case ValueType.Ref:
        return this.getRef('refValue')!
      case ValueType.Array:
        return this.listRefs('arrayValue').map((item) => item.getValue() as LiteralOrPropertyValue)
    }
  }
}
