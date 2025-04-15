<script setup lang="ts">
import { watchEffect, ref } from 'vue'
import { filesize } from 'filesize'
import { debounce } from 'throttle-debounce'

import { type InputEvent } from 'shared/types'
import { useEventListener } from 'shared/utils'

import { ACCEPT_AUDIO_FILE_TYPES, ACCEPT_VIDEO_FILE_TYPES } from 'webgl-video-editor'

import { type VideoEditor } from 'webgl-video-editor'
import FilterMenu from './video-editor-filter-menu.vue'

const { editor } = defineProps<{ editor: VideoEditor }>()

const onInputVideoFile = async (event: InputEvent) => {
  const file = event.target.files?.[0]
  if (!file) return
  event.target.value = ''

  await editor.replaceClipSource(file)
}

const getSelectedType = () => editor.selection?.parent.trackType

const showFilterMenu = ref(false)

watchEffect(() => {
  if (editor.selection?.parent.trackType !== 'video') showFilterMenu.value = false
})

const showDebugButtons = ref(import.meta.env.DEV)
const tapCounter = ref(0)
const clearCounterDebounced = debounce(500, () => (tapCounter.value = 0))
useEventListener(
  () => editor.canvas,
  'pointerup',
  () => {
    if (++tapCounter.value === 7) showDebugButtons.value = !showDebugButtons.value
    clearCounterDebounced()
  },
)
</script>

<template>
  <div class="actions">
    <FilterMenu v-if="showFilterMenu" :editor="editor" />

    <div class="toolbar safe-padding-x">
      <button class="toolbar-button" @click="() => editor.splitClipAtCurrentTime()">
        <div class="icon i-tabler-cut" />
        {{ $t('split') }}
      </button>

      <template v-if="editor.selection">
        <button class="toolbar-button" @click="() => editor.deleteSelection()">
          <div class="icon i-tabler-trash" />
          {{ $t('delete') }}
        </button>

        <button
          v-if="getSelectedType() === 'video'"
          :class="['toolbar-button', editor.selection?.filter && 'active']"
        >
          <div
            :class="showFilterMenu ? 'icon i-tabler-filters-filled' : 'icon i-tabler-filters'"
            @click="() => (showFilterMenu = !showFilterMenu)"
          />
          {{ $t('filter') }}
        </button>

        <label class="toolbar-button">
          <div class="icon i-tabler-exchange" />
          <input
            type="file"
            :accept="getSelectedType() === 'audio' ? ACCEPT_AUDIO_FILE_TYPES : ACCEPT_VIDEO_FILE_TYPES"
            :disabled="!editor.selection"
            @input="{ onInputVideoFile }"
            hidden
          />
          {{ $t(`change_${getSelectedType() ?? ''}`) }}
        </label>
      </template>

      <template v-if="showDebugButtons">
        <button class="toolbar-button" @click="() => (editor._showStats = !editor._showStats)">
          <div :class="editor._showStats ? 'icon i-tabler-graph-filled' : 'icon i-tabler-graph'" />
          {{ $t('Debug') }}
        </button>
      </template>

      <button class="toolbar-button" icon="IconTablerDownload" @click="() => editor.export()">
        <div class="icon i-tabler-download" />
        {{ $t('export') }}
      </button>

      <a
        v-if="editor.exportResult"
        :href="editor.exportResult.url"
        target="_blank"
        style="border-radius: 0.5rem; background: var(--gray); padding: 0 1rem; cursor: pointer"
      >
        {{ editor.exportResult.blob.type }} {{ filesize(editor.exportResult.blob.size) }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  position: relative;
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
  align-items: flex-start;

  width: 100%;
  padding-top: 0.675rem;
  padding-bottom: 0.675rem;
  overflow-x: auto;
  color: var(--white);
}

.toolbar-button {
  flex-direction: column;
  align-self: stretch;
  justify-content: flex-start;
  width: 3rem;
  padding: 0.5rem;
  font-size: 0.75rem;
  line-height: initial;
  text-align: center;

  &.active {
    color: var(--yellow);
  }

  .icon {
    font-size: 1.5rem;
  }
}

.safe-padding-x {
  padding-right: max(env(safe-area-inset-right, 1.25rem), 1.25rem);
  padding-left: max(env(safe-area-inset-left, 1.25rem), 1.25rem);
}

.toolbar-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  padding: 0;
  cursor: pointer;
  border-radius: 0.5rem;

  &:hover {
    background-color: var(--white-1);
  }

  &:active {
    background-color: var(--white-2);
  }

  &.overlay {
    background-color: var(--primary-bg-05);

    &:hover {
      background-color: var(--black-3);
    }

    &:active {
      background-color: var(--black-3);
    }
  }

  &[disabled] {
    cursor: default;
    background-color: transparent;
    opacity: 0.625;
  }
}
</style>
