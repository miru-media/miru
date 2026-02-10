import * as Y from 'yjs'

import { createInitialUpdate } from 'webgl-video-editor/store/utils.ts'

const ydoc = new Y.Doc()

ydoc.clientID = 0

const ymap = ydoc.getMap('video-editor')
const base64 = createInitialUpdate(ymap)

process.stdout.write(base64)
process.stdout.write('\n')
