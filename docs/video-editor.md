---
layout: false
title: Video editor
navbar: false
---

<script setup lang="ts">
import { useRouter } from 'vitepress'
import * as Y from 'yjs'

import { VideoEditorApp } from 'app-video-editor'

const router = useRouter()
import { useVideoEditorStore } from './video-editor-demo/video-editor-demo-store'

const store = useVideoEditorStore(new Y.Doc())
</script>

<div >
  <ClientOnly>
    <VideoEditorApp v-if="store" :store :onCloseProject="() => router.go('/')" />
  </ClientOnly>
</div>
