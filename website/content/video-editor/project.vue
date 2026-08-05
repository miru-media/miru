<script setup lang="ts">
import { useDebounceFn, useLocalStorage } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { computed, ref, toRef, watch } from 'vue'

import { useEditorThumbnail, VideoEditorDoc, VideoEditorDocError, type DocListItem } from 'app-video-editor'

import { thumbnailStorage } from './thumbnail-storage.ts'
import { useSyncedVideoEditor } from './synced-video-editor.ts'

const UPDATED_AT_DEBOUNCE_MS = 500
const UPDATED_AT_MAX_WAIT_MS = 2_000

const docs = import.meta.env.SSR ? ([] as never) : useLocalStorage<DocListItem[]>('video-editor-docs', [])
const id = computed(() => router.currentRoute.value.query.id || '')
const name = computed({
  get: () => docs.value.find((doc) => doc.id == id.value)?.name,
  set: (value: string) => {
    docs.value = docs.value.map((doc) => (doc.id === id.value ? { ...doc, name: value } : doc))
  },
})
const router = useRouter()

const { editor, webrtc, error } = useSyncedVideoEditor(
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

useEditorThumbnail(editor, (canvas: HTMLCanvasElement | OffscreenCanvas) => {
  thumbnailStorage.setFromCanvas(String(id.value), canvas)
})

watch(editor, (editor, _prev, onCleanup) => {
  if (!editor) return
  const abort = new AbortController()
  const bumpUpdatedAt = useDebounceFn(
    () => {
      docs.value = docs.value.map((doc) =>
        doc.id === id.value ? { ...doc, updatedAt: new Date().toISOString() } : doc,
      )
    },
    UPDATED_AT_DEBOUNCE_MS,
    { maxWait: UPDATED_AT_MAX_WAIT_MS },
  )
  editor.sync!.addEventListener('change', bumpUpdatedAt, { signal: abort.signal })
  onCleanup(abort.abort.bind(abort))
})
</script>

<template>
  <VideoEditorDocError v-if="error" backUrl="/video-editor" />
  <VideoEditorDoc v-else-if="editor" class="fullscreen-app" :editor>
    <template #header-start>
      <router-link to="/" class="nav-brand mt-[-6px] px-2 flex-shrink-0" :title="$t('close_project')">
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
        class="border-none bg-transparent p-0.5rem rounded-lg text-center w-fit-content flex-grow-1 flex-shrink-1"
        :aria-label="$t('project_title')"
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
