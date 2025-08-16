---
layout: page
title: Video editor
navbar: false
pageClass: demo-page video-editor-demo-page
---

<script setup lang="ts">
import * as Y from 'yjs'

import { VideoEditorApp } from 'app-video-editor'
import { useVideoEditorStore } from './video-editor-demo/video-editor-demo-store'

const store = useVideoEditorStore(new Y.Doc())
</script>

<div class="demo-container">
  <ClientOnly>
    <VideoEditorApp v-if="store" :store class="demo-container" />
  </ClientOnly>
</div>
