import type { InteractivityConfiguration, InteractivityValue } from '../../types'

import { type IInteractivityGraphProperty, InteractivityGraphProperty } from './interactivity-graph-property'
import type { Type } from './type'

type Literal = boolean | number | string | number[] | string[] | null

export interface IValue extends IInteractivityGraphProperty {
  type: Type
  value: Literal
}

export abstract class ValueContainer extends InteractivityGraphProperty<IValue> {
  setValue(value: Literal) {
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

  serializeAsJson() {
    const value = this.getValue()
    return value == null ? null : Array.isArray(value) ? value : ([value] as boolean[] | number[] | string[])
  }

  setValueFromJson(valueJson: InteractivityValue | InteractivityConfiguration[string] | undefined) {
    const value = valueJson?.value
    return this.setValue(value == null ? null : value.length === 1 ? value[0] : (value as Literal))
  }
}
