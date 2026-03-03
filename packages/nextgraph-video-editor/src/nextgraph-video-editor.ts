import type { Session } from '@ng-org/web'
import { type MediaAsset, VideoEditor } from 'webgl-video-editor'

import type { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'

import { NextGraphAssetLoader } from './nextgraph-asset-loader.ts'

export class NextGraphVideoEditor extends VideoEditor {
  readonly #session: Session
  readonly #nuri: string

  declare readonly store: VideoEditorYjsStore

  constructor(options: { store: VideoEditorYjsStore; session: Session; nuri: string }) {
    super(options)
    this.#session = options.session
    this.#nuri = options.nuri

    this.doc.assets.loaders.push(new NextGraphAssetLoader(options))
  }

  async createMediaAsset(source: File): Promise<MediaAsset> {
    const asset = await super.createMediaAsset(source)

    void this.uploadFile(asset, source)
    return asset
  }

  async uploadFile(asset: MediaAsset, file: File): Promise<void> {
    const { ng, session_id: sessionId } = this.#session

    const uploadId: string = await ng.upload_start(sessionId, this.#nuri, asset.mimeType)

    await file.stream().pipeTo(
      new WritableStream({
        write: (chunk) => ng.upload_chunk(sessionId, uploadId, chunk, this.#nuri),
      }),
    )

    const res = await ng.upload_done(uploadId, sessionId, this.#nuri, file.name)

    asset.uri = res.nuri

    this.store.assetsYmap.set(asset.id, asset.toObject())
  }
}
