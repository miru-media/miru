<script setup lang="ts">
import { VideoEditorApp } from 'app-video-editor'
import { markRaw } from 'vue'
import * as Y from 'yjs'

import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'
import { setupProviders } from './providers'
import { INITIAL_DOC_UPDATE } from './constants'

const { nuri } = defineProps<{ nuri: string }>()
const ydoc = new Y.Doc()

Y.applyUpdateV2(ydoc, INITIAL_DOC_UPDATE)

const store = markRaw(new VideoEditorYjsStore(ydoc.getMap('ng')))

console.log(location.origin + import.meta.env.BASE_URL + '#' + nuri)
await setupProviders(nuri, ydoc)
</script>

<template>
  <video-editor-app :store />
</template>
