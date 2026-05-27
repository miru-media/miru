import { effect } from '@ng-org/orm'
import type { Session } from '@ng-org/web'
import { type AssetsByType, FileSystemAssetStore, type MediaAsset, type Schema } from 'webgl-video-editor'

import { NextGraphAssetLoader } from './nextgraph-asset-loader.ts'
import type { MiruMediaAsset, MiruVideoDocument, MiruVideoEffectAsset } from './shapes/orm/video.typings.ts'
import { withEmptyGraphIds } from './utils.ts'

export class NextGraphAssetStore extends FileSystemAssetStore {
  session: Session
  graphObject: MiruVideoDocument
  readonly #stopEffect: () => void

  get docNuri(): string {
    return this.graphObject['@graph']
  }

  constructor(options: { session: Session; graphObject: MiruVideoDocument }) {
    super()
    this.session = options.session
    this.graphObject = options.graphObject

    this.#stopEffect = effect(() => {
      options.graphObject.assets?.forEach((asset) => {
        const { id } = asset

        if (this.has(id)) {
          const editorAsset = this.getAsset(id)
          if (editorAsset?.type === 'asset:media:av' && !editorAsset.uri && !editorAsset.blob) {
            editorAsset.uri = 'uri' in asset ? asset.uri : undefined
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

    this.on('asset:delete', ({ asset }) => {
      const ormAsset = [...(this.graphObject.assets ?? [])].find((a) => a.id === asset.id)
      if (!ormAsset) return

      this.graphObject.assets?.delete(ormAsset)
      // eslint-disable-next-line no-alert -- TODO
      alert('TODO: file not deleted from NG store')
    })

    this.loaders.push(new NextGraphAssetLoader({ ...options, nuri: this.docNuri }))
  }

  create<T extends Schema.AnyAssetSchema>(
    init: T,
    options?: { source?: Blob | File | string },
  ): AssetsByType[T['type']] {
    const asset = super.create(init, options)

    if (asset.isBuiltIn) return asset

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
      case 'asset:font':
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
    return NextGraphAssetStore.assetToOrmShape(asset, this.docNuri)
  }

  static assetToOrmShape(
    asset: Schema.AnyAssetSchema,
    docNuri: string,
  ): MiruMediaAsset | MiruVideoEffectAsset {
    const { id, type, name = '' } = asset
    switch (type) {
      case 'asset:effect:video': {
        const { ops } = asset

        return {
          '@graph': docNuri,
          '@id': '',
          '@type': new Set(['did:ng:z:MiruVideoEffectAsset']),
          id,
          name,
          type,
          ops: JSON.stringify(ops),
        }
      }
      case 'asset:media:av': {
        const { audio, video } = asset

        return {
          '@graph': docNuri,
          '@id': '',
          '@type': new Set(['did:ng:z:MiruMediaAsset']),
          id,
          type,
          name,
          mimeType: asset.mimeType,
          duration: asset.duration,
          size: asset.size,
          audio: audio && withEmptyGraphIds(audio),
          video: video && withEmptyGraphIds(video),
          uri: asset.uri ?? '',
          thumbnailUri: asset.thumbnailUri,
        } satisfies MiruMediaAsset
      }
      case 'asset:font': {
        // TODO
        throw new Error('Not implemented yet: "asset:font" case')
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

    // eslint-disable-next-line require-atomic-updates -- assume we're creating the asset
    asset.uri = uploadRes.nuri

    const ormAsset = this.findOrmAsset<MiruMediaAsset>(asset)
    if (ormAsset) ormAsset.uri = uploadRes.nuri
  }

  private findOrmAsset<T extends MiruMediaAsset | MiruVideoEffectAsset>(asset: MediaAsset): T | undefined {
    for (const obj of this.graphObject.assets ?? []) if (obj.id === asset.id) return obj as T
  }

  dispose(): void {
    if (this.isDisposed) return
    super.dispose()
    this.graphObject = undefined as never
    this.#stopEffect()
  }
}
