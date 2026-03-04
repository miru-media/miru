import type { Session } from '@ng-org/web'
import { VideoEditor } from 'webgl-video-editor'

import type { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'

import { NextGraphAssetStore } from './nextgraph-asset-store.ts'
import type { MiruVideo } from './shapes/orm/video.typings.ts'

export class NextGraphVideoEditor extends VideoEditor {
  session: Session

  declare readonly store: VideoEditorYjsStore

  constructor(options: { store: VideoEditorYjsStore; session: Session; graphObject: MiruVideo }) {
    super({ ...options, assets: new NextGraphAssetStore(options) })

    this.session = options.session
  }

  dispose(): void {
    super.dispose()
    this.doc.assets.dispose()
    this.session =  undefined as never
  }
}
