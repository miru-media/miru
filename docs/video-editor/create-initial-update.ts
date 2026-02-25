import * as Y from 'yjs'

import { YTREE_YMAP_KEY } from 'webgl-video-editor/store/constants.ts'
import { createInitialUpdate } from 'webgl-video-editor/store/utils.ts'

const ydoc = new Y.Doc()

ydoc.clientID = 0

const base64 = createInitialUpdate({
  tree: ydoc.getMap(YTREE_YMAP_KEY),
  settings: ydoc.getMap('settings'),
})

process.stdout.write(base64)
process.stdout.write('\n')
