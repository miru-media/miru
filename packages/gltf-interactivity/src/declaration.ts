import * as gltf from '@gltf-transform/core'

import { InteractivityPropertyType } from './constants'
import { type IInteractivityGraphProperty, InteractivityGraphProperty } from './interactivity-graph-property'
import { type Type } from './type'

export interface IDeclaration extends IInteractivityGraphProperty {
  op: string
  config: gltf.RefMap<gltf.Property>
  extension: string | null
  inputValueSockets: gltf.RefMap<Type>
  outputValueSockets: gltf.RefMap<Type>
}

type StringKeys<T extends object> = Extract<keyof T, string>

export class Declaration<
  TConfig extends object = Record<string, never>,
> extends InteractivityGraphProperty<IDeclaration> {
  init() {
    this.propertyType = InteractivityPropertyType.DECLARATION
  }

  getDefaults() {
    const defaults: Omit<IDeclaration, keyof IInteractivityGraphProperty> = {
      op: '',
      config: new gltf.RefMap<never>(),
      extension: null,
      inputValueSockets: new gltf.RefMap(),
      outputValueSockets: new gltf.RefMap(),
    }

    return Object.assign(super.getDefaults(), defaults)
  }

  setOp(op: string) {
    return this.set('op', op)
  }

  getOp() {
    return this.get('op')
  }

  setExtensionName(name: string | null) {
    this.set('extension', name)
  }
  getExtensionName() {
    return this.get('extension')
  }

  setInputValueSocket(id: string, type: Type | null) {
    return this.setRefMap('inputValueSockets', id, type)
  }
  getInputValueSocket<T extends StringKeys<TConfig>>(id: T) {
    return this.getRefMap('inputValueSockets', id) as TConfig[T] | null
  }
  listInputValueSocketIds() {
    return this.listRefMapKeys('inputValueSockets')
  }

  setOutputValueSocket(id: string, type: Type | null) {
    return this.setRefMap('outputValueSockets', id, type)
  }
  getOutputValueSocket(id: string) {
    return this.getRefMap('outputValueSockets', id)
  }
  listOutputValueSocketIds() {
    return this.listRefMapKeys('outputValueSockets')
  }
}
