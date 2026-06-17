<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import type { VideoEditor, VideoEditorAssetStore, VideoEditorDocumentSync } from 'webgl-video-editor'
import de from 'webgl-video-editor/locales/de.json'
import en from 'webgl-video-editor/locales/en.json'
import VideoEditorUI, { EDITOR_SELECTION_ACTIONS_BY_ID } from 'webgl-video-editor/vue'
import Header from './video-editor-header.vue'
import { isElement } from 'shared/utils'
import IntroModal from './info-modal.vue'
import { state } from './state.ts'
import { ARROW_KEY_DELTA_S } from 'shared/video/constants.ts'

const { sync, editor: editorProp } = defineProps<{
  sync?: VideoEditorDocumentSync
  assets?: VideoEditorAssetStore
  editor?: VideoEditor
}>()

const editorRef = ref<VideoEditor>()

if (!import.meta.env.SSR) {
  // Keyboard shortcuts
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    const target = event.composedPath()[0]
    const editor = editorRef.value

    if (
      !editor ||
      (isElement(target) && target.closest('select,input,textarea,[contenteditable=true],dialog'))
    )
      return

    const { sync: sync } = editor

    if (event.ctrlKey) {
      switch (event.code) {
        case 'KeyZ': {
          if (event.shiftKey) sync?.redo()
          else sync?.undo()
          event.preventDefault()
          break
        }
        case 'KeyY': {
          sync?.redo()
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
        if (editor.playback.isPaused) editor.playback.play()
        else editor.playback.pause()
        event.preventDefault()
        break

      case 'Delete':
        EDITOR_SELECTION_ACTIONS_BY_ID.delete.exec(editor)
        break

      case 'KeyS':
        if (event.repeat) break
        EDITOR_SELECTION_ACTIONS_BY_ID.split.exec(editor)
        break

      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        const { frameRate } = editor.doc
        const deltaS =
          (event.shiftKey ? ARROW_KEY_DELTA_S : 1 / frameRate) *
          (event.code === 'ArrowLeft' || event.code === 'ArrowUp' ? -1 : 1)
        editor.seekTo(editor.currentTime + deltaS)
        event.preventDefault()
        break
      }
    }
  })
}
</script>

<template>
  <div class="video-editor-app">
    <VideoEditorUI
      ref="editorRef"
      :sync
      :assets
      :messages="{ en, de }"
      :editor="editorProp"
      :onClickHelp="() => (state.showInfo = true)"
      class="video-editor"
    >
      <template #header>
        <Header v-if="editorRef" :editor="editorRef">
          <template v-if="$slots['header-start']" #start><slot name="header-start"></slot></template>
          <template #middle><slot name="header-middle"></slot></template>
        </Header>
      </template>
    </VideoEditorUI>
    <IntroModal />
  </div>
</template>

<style scoped>
.video-editor-app {
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
  --primary-bg: #171717;
  --primary-bg-05: #17171788;

  --font-size-m: 0.865rem;
  --line-height-ui-m: revert;

  accent-color: #006aeb;
  color-scheme: dark;
}

.video-editor {
  height: 100dvh;
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
