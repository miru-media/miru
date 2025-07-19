import * as gltf from '@gltf-transform/core'

import type { MaybeArray } from 'shared/types'

import { isSingleLiteral } from '../utils'

import type { Event } from './event'
import type { Flow } from './flow'
import { type IInteractivityGraphProperty, InteractivityGraphProperty } from './interactivity-graph-property'
import type { Node } from './node'
import { InteractivityPropertyType } from './property-types'
import type { Type } from './type'
import type { Variable } from './variable'

type PropertyValueType = Type | Variable | Event | Node | Flow
type LiteralValueType = string | number | boolean

export type LiteralOrPropertyValue = PropertyValueType | LiteralValueType

const enum ValueType {
  Ref,
  Literal,
  Array,
}

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
