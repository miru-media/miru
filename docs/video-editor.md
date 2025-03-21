---
layout: page
title: Video editor
navbar: false
pageClass: demo-page video-editor-demo-page
---

<script setup lang="ts">
import 'miru-video-editor/elements'

import { demoMovie } from 'miru-video-editor/demoMovie'
import { type VideoEditorElement } from 'miru-video-editor/elements'
import de from 'miru-video-editor/locales/de.json'
import { ref, watch } from 'vue'
import { VideoEditorChangeEvent, VideoEditorChangeLoadingEvent } from 'miru-video-editor'
import { useI18n } from 'vue-i18n-lite'

const editor = ref<VideoEditorElement>()
const isLoading = ref(true)

const LOCAL_STORAGE_PREFIX = 'video-editor:'
const movieContentKey = `${LOCAL_STORAGE_PREFIX}content`

const { t } = useI18n()

watch(editor, (editor) => {
  if (!editor) return

  // restore movie from localStorage
  const savedJson = localStorage.getItem(movieContentKey)

  if (savedJson) {
    ; (async () => {
      const parsed = JSON.parse(savedJson)
      return editor.replaceContent(parsed)
    })().catch((error: unknown) => {
      const message = t('restore_failed')

      /* eslint-disable no-console */
      console.error(error)
      console.warn(message, savedJson)
      /* eslint-enable no-console */
      alert(message)

      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}backup`, savedJson)
    })
  }

  isLoading.value = editor.isLoading
}, { immediate: true })

// persist to localStorage
const onChange = (event: VideoEditorChangeEvent) => localStorage.setItem(movieContentKey, JSON.stringify(event.detail))

const onChangeLoading = (event: VideoEditorChangeLoadingEvent) => isLoading.value = event.detail
</script>

<div class="demo-container">
  <video-editor ref="editor" :messages="{ de }" style="height: 100%" @change="onChange"
    @changeloading="onChangeLoading">
    <button v-if="!isLoading" slot="empty" type="button" class="demo-video-button"
      @click="() => editor?.replaceContent(demoMovie)">
      {{ t('load_demo_video') }}
    </button>
  </video-editor>
</div>

<style scoped>
.demo-video-button {
  position: absolute;
  left: 1rem;
  display: flex;
  gap: 0.675rem;
  align-items: center;
  justify-content: center;
  min-width: var(--clip-height);
  height: var(--clip-height);
  padding: 0.675rem 0.875rem;
  color: var(--white-3);
  cursor: pointer;
  background-color: rgb(255 255 255 / 3%);
  border: dashed;
  border-color: rgb(255 255 255 / 12%);
  border-radius: 0.625rem;
  translate: var(--track-width);

  font-size: 14px;
  font-weight: 500;
  line-height: 17px;
}
</style>
