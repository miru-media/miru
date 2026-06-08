<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { computed, ref } from 'vue'

import { VideoEditorDoc, VideoEditorDocError } from 'app-video-editor'
import { useVideoEditorStore } from './video-editor-demo-store'
import { toRef } from 'vue'

const projects = import.meta.env.SSR
  ? ([] as never)
  : useLocalStorage<{ name: string; id: string; createdAt: string }[]>('video-editor-docs', [])
const id = computed(() => router.currentRoute.value.query.id || '')
const name = computed({
  get: () => projects.value.find((p) => p.id == id.value)?.name,
  set: (value: string) => {
    projects.value = projects.value.map((p) => (p.id === id.value ? { ...p, name: value } : p))
  },
})
const router = useRouter()

const { sync, webrtc, error } = useVideoEditorStore(
  toRef(() => id.value.toString()),
  console.error,
)
const isConnected = ref(true)

const toggleConnection = () => {
  const connect = (isConnected.value = !isConnected.value)
  if (connect) webrtc.value?.connect()
  else webrtc.value?.disconnect()
}

const showConnectionToggle = import.meta.env.DEV
</script>

<template>
  <VideoEditorDocError v-if="error" backUrl="/video-editor" />
  <VideoEditorDoc v-else-if="sync" class="fullscreen-app" :sync>
    <template #header-start>
      <router-link to="/" class="nav-brand mt-[-6px] px-2" :title="$t('close_project')">
        <span class="sr-only">{{ $t('close_project') }}</span>
        <img
          src="../../../website/content/media/logo/white-logo.svg"
          style="width: auto; height: 28px"
          alt=""
        />
      </router-link>
    </template>
    <template #header-middle>
      <input
        v-model="name"
        class="border-none bg-transparent p-0.5rem rounded-lg text-center w-full"
        :aria-label="$t('title')"
      />
    </template>
  </VideoEditorDoc>
  <button
    aria-label="(dev) toggle collaboration connection"
    title="(dev) toggle collaboration connection"
    v-if="showConnectionToggle"
    class="absolute top-0 right-0 p-0.5rem"
    @click="toggleConnection"
  >
    <div :class="['inline-block w-1rem h-1rem rounded-full', isConnected ? 'bg-#0b0' : 'bg-white']" />
  </button>
</template>
