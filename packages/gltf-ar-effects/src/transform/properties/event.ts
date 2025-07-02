import * as gltf from '@gltf-transform/core'

import { type IInteractivityGraphProperty, InteractivityGraphProperty } from './interactivity-graph-property'
import { InteractivityPropertyType } from './property-types'
import type { Value } from './value'

export interface IEvent extends IInteractivityGraphProperty {
  id: string | null
  values: gltf.RefMap<Value>
}

export class Event extends InteractivityGraphProperty<IEvent> {
  init() {
    this.propertyType = InteractivityPropertyType.EVENT
  }

  getDefaults() {
    return Object.assign(super.getDefaults(), {
      values: new gltf.RefMap(),
    })
  }

  setId(id: string | null) {
    return this.set('id', id)
  }
  getId() {
    return this.get('id')
  }

  setValue(id: string, value: Value) {
    return this.setRefMap('values', id, value)
  }
  getValue(id: string) {
    return this.getRefMap('values', id)
  }
  listValueIds() {
    return this.listRefMapKeys('values')
  }
}
