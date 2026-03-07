import * as Y from 'yjs'

import { createInitialUpdate } from 'webgl-video-editor/yjs'

const ydoc = new Y.Doc()

ydoc.clientID = 0

const base64 = createInitialUpdate(ydoc)

process.stdout.write(base64)
process.stdout.write('\n')
