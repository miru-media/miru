<script setup lang="ts">
import { VideoEditorApp } from 'app-video-editor'
import { markRaw } from 'vue'
import * as Y from 'yjs'

import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'
import { setupProviders } from './providers'
import { YTREE_YMAP_KEY } from 'webgl-video-editor/store/constants.js'

const { ydoc } = defineProps<{ ydoc: Y.Doc }>()

const store = markRaw(new VideoEditorYjsStore(ydoc.getMap(YTREE_YMAP_KEY), ydoc.getMap('assets')))

await setupProviders(ydoc.guid, ydoc)
</script>

<template>
  <video-editor-app :store />
</template>
