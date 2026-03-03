<script setup lang="ts">
import { VideoEditorApp } from 'app-video-editor'
import { markRaw } from 'vue'
import * as Y from 'yjs'

import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'
import { setupProviders } from './providers'
import { INITIAL_DOC_UPDATE } from './constants'
import { YTREE_YMAP_KEY } from 'webgl-video-editor/store/constants.js'
import { NextGraphVideoEditor } from './nextgraph-video-editor'

const { nuri } = defineProps<{ nuri: string }>()
const ydoc = new Y.Doc()

Y.applyUpdateV2(ydoc, INITIAL_DOC_UPDATE)
const ngMap = ydoc.getMap<Y.Map<any>>('ng')

const [ngProvider] = await setupProviders(nuri, ydoc)
const { session } = ngProvider

const store = markRaw(new VideoEditorYjsStore(ngMap.get(YTREE_YMAP_KEY)!))
const editor = new NextGraphVideoEditor({ store, session, nuri })

const onCloseProject = () => (location.hash = '')

console.log(location.origin + import.meta.env.BASE_URL + '#' + nuri)
</script>

<template>
  <video-editor-app :store :onCloseProject :editor />
</template>
