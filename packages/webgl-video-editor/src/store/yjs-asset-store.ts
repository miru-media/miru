import type * as Y from 'yjs'

import { FileSystemAssetStore } from '#assets'
import type { Schema } from '#core'

export class YjsAssetStore extends FileSystemAssetStore {
  ymap: Y.Map<Schema.AnyAssetSchema>

  readonly #boundOnYmapUpdate = this.#onYmapUpdate.bind(this)

  constructor(ymap: Y.Map<Schema.AnyAssetSchema>) {
    super()
    this.ymap = ymap

    ymap.forEach((init) => this.create(init))

    this.on('asset:create', ({ asset }) => this.ymap.set(asset.id, asset.toObject()))
    this.on('asset:delete', ({ asset }) => this.ymap.delete(asset.id))

    ymap.observe(this.#boundOnYmapUpdate)
  }

  #onYmapUpdate(event: Y.YEvent<typeof this.ymap>) {
    const { ymap } = this
    event.keys.forEach(({ action }, id) => {
      if (action === 'add' && !ymap.has(id)) this.create(ymap.get(id)!)
      else if (action === 'delete' && ymap.has(id)) ymap.delete(id)
    })
  }

  dispose(): void {
    super.dispose()
    this.ymap.unobserve(this.#boundOnYmapUpdate)
  }
}
