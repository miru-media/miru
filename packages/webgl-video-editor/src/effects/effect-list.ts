import type { VideoEffectAsset } from '#assets'
import type * as pub from '#core'
import type { Schema } from '#core'

import { defineReactiveProp, DLLNode, NodePropList } from '../nodes/utils.ts'

export interface EffectList extends NodePropList<EffectListItem>, Array<EffectListItem> {}

export class EffectList extends NodePropList<EffectListItem> {
  protected constructor(emitAction: (action: pub.NodeListChangeEvent.Action) => void) {
    super(emitAction)
  }

  static create(emitAction: (action: pub.NodeListChangeEvent.Action) => void) {
    const list = new this(emitAction)
    const proxy = new Proxy(list, this.#proxyHandler)
    return proxy
  }

  static readonly #proxyHandler: ProxyHandler<EffectList> = {
    get(target, key) {
      if (Reflect.has(target, key)) return Reflect.get(target, key, target)

      const array = target.array.value
      if (typeof key === 'number') return array[key]
      return Reflect.get(array, key, array)
    },
  }
}

export class EffectListItem extends DLLNode implements Omit<pub.EffectListItem, 'asset'> {
  declare assetId: string
  declare intensity: number

  declare asset: VideoEffectAsset | undefined

  constructor({ assetId, intensity }: Schema.EffectListItem) {
    super()

    defineReactiveProp(this, 'assetId', assetId)
    defineReactiveProp(this, 'intensity', intensity)

    defineReactiveProp(this, 'asset')
  }

  toJSON(): Schema.EffectListItem {
    const { assetId, intensity } = this
    return { assetId, intensity }
  }
}
