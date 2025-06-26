<script setup lang="ts">
import 'webgl-video-editor/elements'

import { demoMovie } from './demoMovie'
import { type VideoEditor } from 'webgl-video-editor'
import de from 'webgl-video-editor/locales/de.json'
import en from 'webgl-video-editor/locales/en.json'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n-lite'
import Toolbar from './video-editor-toolbar.vue'
import VideoEditorUI from 'webgl-video-editor/vue'
import Settings from './video-editor-settings.vue'
import { useEventListener } from '@vueuse/core'
import { isElement } from 'shared/utils'

const editorRef = ref<VideoEditor>()

const LOCAL_STORAGE_PREFIX = 'video-editor:'
const MOVIE_CONTENT_KEY = `${LOCAL_STORAGE_PREFIX}content`

const { t } = useI18n()

if (!import.meta.env.SSR) {
  watch(
    editorRef,
    (editor) => {
      if (!editor) return

      // restore movie from localStorage
      const savedJson = localStorage.getItem(MOVIE_CONTENT_KEY)

      if (savedJson) {
        ;(async () => {
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
    },
    { immediate: true },
  )

  // Persist to localStorage
  watch(
    () => editorRef.value?.state,
    (state) => state && localStorage.setItem(MOVIE_CONTENT_KEY, JSON.stringify(state)),
  )

  // Keyboard shortcuts
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    const target = event.composedPath()[0]
    const editor = editorRef.value

    if (!editor || (isElement(target) && target.closest('select,input,textarea,[contenteditable=true]')))
      return

    if (event.ctrlKey) {
      switch (event.code) {
        case 'KeyZ': {
          if (event.shiftKey) editor.redo()
          else editor.undo()
          event.preventDefault()
          break
        }
        case 'KeyY': {
          editor.redo()
          event.preventDefault()
          break
        }
      }
      return
    }

    switch (event.code) {
      case 'Space':
      case 'MediaPlayPause':
        if (event.repeat) break
        if (editor.isPaused) editor.play()
        else editor.pause()
        event.preventDefault()
        break

      case 'Delete':
        editor.deleteSelection()
        break

      case 'KeyS':
        if (event.repeat) break
        editor.splitClipAtCurrentTime()
        break

      case 'ArrowLeft': {
        const prev = editor.selection?.prev
        if (prev) editor.selectClip(prev)

        event.preventDefault()
        break
      }

      case 'ArrowRight': {
        const next = editor.selection?.next
        if (next) editor.selectClip(next)
        event.preventDefault()
        break
      }
    }
  })
}
</script>

<template>
  <div class="demo-container">
    <VideoEditorUI ref="editorRef" :messages="{ en, de }" class="video-editor">
      <button
        v-if="!editorRef?.isLoading"
        slot="empty"
        type="button"
        class="demo-video-button"
        @click="() => editorRef?.replaceContent(demoMovie)"
      >
        {{ t('load_demo_video') }}
      </button>
      <Toolbar v-if="editorRef" :editor="editorRef" />
    </VideoEditorUI>
    <Settings v-if="editorRef" :editor="editorRef" />
  </div>
</template>

<style scoped>
.demo-container {
  --black: #000;
  --white: #fff;
  --gray: #252525;
  --red-dark: #e83757;
  --red: #ff5372;
  --red-light: #ff7a92;
  --purple-dark: #8f54f9;
  --purple: #a06efb;
  --purple-light: #ac7dff;
  --yellow-dark: #ead627;
  --yellow: #feea38;
  --yellow-light: #fff38b;
  --green-dark: #03b072;
  --green: #03ad70;
  --green-light: #1ed291;
  --black-1: rgb(0 0 0 / 10%);
  --black-2: rgb(0 0 0 / 30%);
  --black-3: rgb(0 0 0 / 60%);
  --white-1: rgb(255 255 255 / 10%);
  --white-2: rgb(255 255 255 / 30%);
  --white-3: rgb(255 255 255 / 60%);
  --ruler-height: 1rem;
  --ruler-spacing-top: 0.25rem;
  --ruler-spacing-bottom: 2.625rem;
  --primary-bg: #171717;
  --primary-bg-05: #17171788;

  color-scheme: dark;
}

.video-editor {
  height: 100%;
}

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
