import type { InteractivityConfiguration, InteractivityValue } from '../../types'

import { type IInteractivityGraphProperty, InteractivityGraphProperty } from './interactivity-graph-property'
import type { Type } from './type'

export type LiteralValueValue = boolean | number | string | number[] | string[] | null

export interface ILiteralValue extends IInteractivityGraphProperty {
  type: Type
  value: LiteralValueValue
}

export abstract class LiteralValueContainer extends InteractivityGraphProperty<ILiteralValue> {
  setValue(value: LiteralValueValue) {
    return this.set('value', value)
  }

  getValue() {
    return this.get('value')
  }

  setType(type: Type) {
    return this.setRef('type', type)
  }
  getType() {
    return this.getRef('type')
  }

  setValueFromJson(valueJson: InteractivityValue | InteractivityConfiguration[string] | undefined) {
    const value = valueJson?.value
    return this.setValue(value == null ? null : value.length === 1 ? value[0] : (value as LiteralValueValue))
  }
}
