import type * as pub from '../../types/core'
import type * as Schema from '../../types/schema'

export abstract class BaseAsset<T extends Schema.AnyAssetSchema = any> {
  store: pub.VideoEditorAssetStore
  readonly id: string
  readonly type: T['type']
  readonly raw: T
  readonly isBuiltIn: boolean

  constructor(init: T, store: pub.VideoEditorAssetStore, isBuiltIn?: boolean) {
    this.store = store
    this.id = init.id
    this.type = init.type
    this.raw = init
    this.isBuiltIn = !!isBuiltIn
  }

  toJSON(): T {
    return this.raw
  }

  dispose(): void {
    this.store = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
