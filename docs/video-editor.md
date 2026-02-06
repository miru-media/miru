---
layout: false
title: Video editor
navbar: false
---

<script setup lang="ts">
import { useRouter } from 'vitepress'
import { ref } from 'vue'
import * as Y from 'yjs'

import { VideoEditorApp } from 'app-video-editor'

const router = useRouter()
import { useVideoEditorStore } from './video-editor-demo/video-editor-demo-store'

const { store, webrtc } = useVideoEditorStore(new Y.Doc())
const isConnected = ref(true)

const toggleConnection = () =>{
  const connect = (isConnected.value = !isConnected.value)
  if (connect) webrtc?.connect()
  else webrtc?.disconnect()
}

const showConnectionToggle = import.meta.env.DEV

</script>

<div >
  <ClientOnly>
    <VideoEditorApp v-if="store" :store :onCloseProject="() => router.go('/')" />
      <button v-if="showConnectionToggle" :class="['absolute top-0 right-0 m-1rem w-1rem h-1rem rounded-full', isConnected ? 'bg-#0b0' : 'bg-white']" @click="toggleConnection" />
  </ClientOnly>
</div>
