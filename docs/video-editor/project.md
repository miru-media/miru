---
layout: false
title: Video editor
navbar: false
---

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { useRouter } from 'vitepress'
import { computed, ref } from 'vue'

import { VideoEditorApp } from 'app-video-editor'
import { useVideoEditorStore } from './video-editor-demo-store'

const projects = import.meta.env.SSR ? [] as never: useLocalStorage<{ name: string; id: string, createdAt: string }[]>('video-editor-docs', [])
const id = computed(() => new URLSearchParams(router.route.query).get('id') || '')
const name = computed({
  get: () => projects.value.find(p => p.id == id.value)?.name,
  set: (value: string) => {
    projects.value = projects.value.map(p => p.id === id.value ? {...p, name: value } : p
  )}
})
const router = useRouter()

const { store, webrtc } = useVideoEditorStore(id)
const isConnected = ref(true)

const toggleConnection = () => {
  const connect = (isConnected.value = !isConnected.value)
  if (connect) webrtc.value?.connect()
  else webrtc.value?.disconnect()
}

const showConnectionToggle = import.meta.env.DEV
</script>

<ClientOnly>
  <VideoEditorApp v-if="store" :store :onCloseProject="() => router.go('/video-editor')" v-model:name="name"/>
  <button
    v-if="showConnectionToggle"
    :class="[
      'absolute top-0 right-0 m-1rem w-1rem h-1rem rounded-full',
      isConnected ? 'bg-#0b0' : 'bg-white',
    ]"
    @click="toggleConnection"
  />
</ClientOnly>
