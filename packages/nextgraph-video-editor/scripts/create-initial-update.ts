import * as Y from 'yjs'

import { YTREE_YMAP_KEY } from 'webgl-video-editor/store/constants.ts'
import { createInitialUpdate, getOrCreateYmap } from 'webgl-video-editor/store/utils.ts'

const ydoc = new Y.Doc()

ydoc.clientID = 0

const ytreeMap = getOrCreateYmap(ydoc.getMap('ng'), YTREE_YMAP_KEY)
const base64 = createInitialUpdate(ytreeMap)

process.stdout.write(base64)
process.stdout.write('\n')
