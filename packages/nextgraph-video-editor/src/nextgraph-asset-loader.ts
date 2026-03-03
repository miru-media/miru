/* eslint-disable @typescript-eslint/class-methods-use-this -- matching interface */
import type { Session } from '@ng-org/web'
import type { AssetLoader, Schema } from 'webgl-video-editor'

export class NextGraphAssetLoader implements AssetLoader {
  session: Session
  nuri: string

  constructor(options: { session: Session; nuri: string }) {
    this.session = options.session
    this.nuri = options.nuri
  }

  canLoad(asset: Schema.MediaAsset): boolean {
    return asset.uri?.startsWith('did:ng:') === true
  }

  async load(asset: Schema.MediaAsset): Promise<{ stream: ReadableStream<Uint8Array>; size?: number }> {
    const uri = asset.uri!

    const { ng, session_id: sessionId } = this.session

    const res = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
      ng.file_get(sessionId, uri, this.nuri, (res: any) => {
        if (res.V0.FileBinary != null) resolve(res.V0.FileBinary)
      }).catch(reject)
    })

    return { stream: new Blob([res]).stream() }
  }

  dispose(): void {
    this.session = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
