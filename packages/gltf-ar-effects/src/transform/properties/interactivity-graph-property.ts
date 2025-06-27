import * as gltf from '@gltf-transform/core'
import { type IProperty } from '@gltf-transform/core'

import { KHR_INTERACTIVITY } from '../../constants'

export interface IInteractivityGraphProperty extends IProperty {
  extensions: gltf.RefMap<gltf.ExtensionProperty>
}

export abstract class InteractivityGraphProperty<
  T extends IInteractivityGraphProperty,
> extends gltf.Property<T> {
  static EXTENSION_NAME = KHR_INTERACTIVITY

  declare propertyType: string
}
