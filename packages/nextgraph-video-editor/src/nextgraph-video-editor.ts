import type { Session } from '@ng-org/web'
import { VideoEditor } from 'webgl-video-editor'

import type { YjsSync } from 'webgl-video-editor/yjs'

import { NextGraphAssetStore } from './nextgraph-asset-store.ts'
import type { MiruVideoDocument } from './shapes/orm/video.typings.ts'

export class NextGraphVideoEditor extends VideoEditor {
  session: Session

  declare readonly sync: YjsSync

  constructor(options: { sync: YjsSync; session: Session; graphObject: MiruVideoDocument }) {
    super({ ...options, assets: new NextGraphAssetStore(options) })

    this.session = options.session
  }

  dispose(): void {
    if (this.isDisposed) return
    super.dispose()
    this.doc.assets.dispose()
    this.session =  undefined as never
  }
}
