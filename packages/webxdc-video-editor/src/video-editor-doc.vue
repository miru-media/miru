<script setup lang="ts">
import { VideoEditorDoc } from 'app-video-editor'
import { markRaw } from 'vue'
import * as Y from 'yjs'

import { YjsSync } from 'webgl-video-editor/yjs'
import { setupProviders } from './providers'

const { ydoc } = defineProps<{ ydoc: Y.Doc }>()

const sync = markRaw(new YjsSync(ydoc))

await setupProviders(ydoc.guid, ydoc)
</script>

<template>
  <VideoEditorDoc :sync />
</template>
