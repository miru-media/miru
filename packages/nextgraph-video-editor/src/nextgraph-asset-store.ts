import { effect } from '@ng-org/orm'
import type { Session } from '@ng-org/web'
import { type AssetsByType, FileSystemAssetStore, type MediaAsset, type Schema } from 'webgl-video-editor'

import { NextGraphAssetLoader } from './nextgraph-asset-loader.ts'
import type { MiruMediaAsset, MiruVideo, MiruVideoEffectAsset } from './shapes/orm/video.typings.ts'

export class NextGraphAssetStore extends FileSystemAssetStore {
  session: Session
  graphObject: MiruVideo
  readonly #stopEffect: () => void

  get docNuri(): string {
    return this.graphObject['@graph']
  }

  constructor(options: { session: Session; graphObject: MiruVideo }) {
    super()
    this.session = options.session
    this.graphObject = options.graphObject

    this.#stopEffect = effect(() => {
      console.log('ASSETS', ...options.graphObject.assets?.__raw__ ?? [])

      options.graphObject.assets?.forEach((asset) => {
        const { id } = asset

        if (this.has(id)) {
          const editorAsset = this.getAsset(id)
          if (editorAsset?.type === 'asset:media:av' && !editorAsset.uri && !editorAsset.blob) {
            editorAsset.uri = asset.uri
          }
        }
        // create new asset instances
        else {
          let init: Schema.AnyAssetSchema

          if (asset.type === 'asset:effect:video') init = { ...asset, id, ops: JSON.parse(asset.ops) }
          else init = { ...asset, id }

          this.create(init)
        }
      })
    })

    this.on('asset:delete', () => {
      throw new Error('TODO: delete assets')
    })

    this.loaders.push(new NextGraphAssetLoader({ ...options, nuri: this.docNuri }))
  }

  create<T extends Schema.AnyAssetSchema>(
    init: T,
    options?: { source?: Blob | File | string },
  ): AssetsByType[T['type']] {
    const asset = super.create(init, options)

    switch (asset.type) {
      case 'asset:media:av': {
        const source = options?.source

        if (source != null && typeof source !== 'string')
          void this.uploadFile(asset, 'name' in source ? source : new File([source], asset.id))
        break
      }
      case 'asset:effect:video':
        this.graphObject.assets?.add(this.assetToOrmShape(asset))
        break
    }

    return asset
  }

  async createMediaAsset(source: Blob | string): Promise<MediaAsset> {
    const init = await this.getMediaAssetInfo(this.generateId(), source)
    const asset = this.create(init, { source })

    this.graphObject.assets?.add(this.assetToOrmShape(init))

    return asset
  }

  assetToOrmShape(asset: Schema.AnyAssetSchema): MiruMediaAsset | MiruVideoEffectAsset {
    const { id, type, name } = asset
    switch (type) {
      case 'asset:effect:video': {
        const { ops } = asset

        return {
          '@graph': this.docNuri,
          '@id': '',
          '@type': 'did:ng:z:MiruVideoEffectAsset',
          id,
          name,
          type,
          ops: JSON.stringify(ops),
        }
      }
      case 'asset:media:av': {
        const { audio, video } = asset

        return {
          '@graph': this.docNuri,
          '@id': '',
          '@type': 'did:ng:z:MiruMediaAsset',
          id,
          type,
          name,
          mimeType: asset.mimeType,
          duration: asset.duration,
          size: asset.size,
          audio: audio && { ...audio, '@graph': this.docNuri, '@id': '' },
          video: video && { ...video, '@graph': this.docNuri, '@id': '' },
          uri: asset.uri ?? '',
        } satisfies MiruMediaAsset
      }
    }
  }

  private async uploadFile(asset: MediaAsset, file: File): Promise<void> {
    const { ng, session_id: sessionId } = this.session

    const uploadId: string = await ng.upload_start(sessionId, this.docNuri, asset.mimeType)

    await file.stream().pipeTo(
      new WritableStream({
        write: (chunk) => ng.upload_chunk(sessionId, uploadId, chunk, this.docNuri),
      }),
    )
    const uploadRes = (await ng.upload_done(uploadId, sessionId, this.docNuri, file.name)) as { nuri: string }

    asset.uri = uploadRes.nuri

    const ormAsset = this.findOrmAsset(asset)
    if (ormAsset) ormAsset.uri = uploadRes.nuri
  }

  private findOrmAsset(asset: MediaAsset) {
    for (const obj of this.graphObject.assets ?? []) if (obj.id === asset.id) return obj
  }

  dispose(): void {
    super.dispose()
    this.graphObject = undefined as never
    this.#stopEffect()
  }
}
