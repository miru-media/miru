/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-extraneous-class -- false positive */
import type * as Y from 'yjs'

import type { VideoEditorAssetStore, VideoEditorDocumentSync } from '#core'

export interface YjsSync extends VideoEditorDocumentSync {}

export class YjsSync implements VideoEditorDocumentSync {
  constructor(ydocOrMap: Y.Doc | Y.Map<any>)
}

export class YjsAssetStore implements VideoEditorAssetStore {
  constructor(ymap: Y.Map<Schema.AnyAssetSchema>)
}
