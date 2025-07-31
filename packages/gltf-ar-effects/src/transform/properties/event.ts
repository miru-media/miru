import * as gltf from '@gltf-transform/core'

import {
  type IInteractivityGraphProperty,
  InteractivityGraphProperty,
} from './interactivity-graph-property.ts'
import type { LiteralValue } from './literal-value.ts'
import { InteractivityPropertyType } from './property-types.ts'

export interface IEvent extends IInteractivityGraphProperty {
  id: string | null
  values: gltf.RefMap<LiteralValue>
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

  setValue(id: string, value: LiteralValue) {
    return this.setRefMap('values', id, value)
  }
  getValue(id: string) {
    return this.getRefMap('values', id)
  }
  listValueIds() {
    return this.listRefMapKeys('values')
  }
}
