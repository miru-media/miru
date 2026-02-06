<script setup lang="ts">
import { VideoEditorApp } from 'app-video-editor'
import { markRaw } from 'vue'
import * as Y from 'yjs'

import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'
import { setupProviders } from './providers'

const { ydoc } = defineProps<{ ydoc: Y.Doc }>()

const store = markRaw(new VideoEditorYjsStore(ydoc.getMap('root')))

await setupProviders(ydoc.guid, ydoc)
</script>

<template>
  <video-editor-app :store />
</template>
