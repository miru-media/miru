<script setup lang="ts">
import { ref } from 'vue'
import { filesize } from 'filesize'
import { debounce } from 'throttle-debounce'

import { useEventListener } from 'shared/utils'

import { AssetBin } from 'webgl-video-editor/vue'

import type { VideoEditor } from 'webgl-video-editor'
import { state } from './state'

const { editor } = defineProps<{ editor: VideoEditor }>()

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
    <div class="toolbar safe-padding-x">
      <button class="toolbar-button" @click="() => editor.splitClipAtCurrentTime()">
        <div class="icon i-material-symbols:split-scene-outline" />
        {{ $t('split') }}
      </button>

      <template v-if="editor.selection">
        <button class="toolbar-button" @click="() => editor.deleteSelection()">
          <div class="icon i-material-symbols: i-material-symbols:delete-outline-rounded" />
          {{ $t('delete') }}
        </button>
      </template>

      <button
        v-if="editor.selection?.isVideo() && editor.selection.isMediaClip()"
        :class="['toolbar-button', editor.selection.effects && 'active']"
        :aria-expanded="editor.activeAssetBin === AssetBin.filters"
        :commandfor="editor.getPartId(AssetBin.filters)"
        command="show-modal"
      >
        <div class="icon i-material-symbols:filter-vintage-outline-rounded" />
        {{ $t('filters') }}
      </button>

      <button
        class="toolbar-button"
        :aria-expanded="editor.activeAssetBin === AssetBin.audio"
        :commandfor="editor.getPartId(AssetBin.audio)"
        command="show-modal"
      >
        <div class="icon i-material-symbols:music-note-rounded" />
        {{ $t('music') }}
      </button>

      <button
        class="toolbar-button"
        :aria-expanded="editor.activeAssetBin === AssetBin.video"
        :commandfor="editor.getPartId(AssetBin.video)"
        command="show-modal"
      >
        <div class="icon i-material-symbols:folder-open-outline-rounded" />
        {{ $t('media') }}
      </button>

      <button
        class="toolbar-button"
        :aria-expanded="editor.activeAssetBin === AssetBin.fonts"
        :commandfor="editor.getPartId(AssetBin.fonts)"
        command="show-modal"
      >
        <div class="icon i-material-symbols:text-fields-rounded" />
        {{ $t('fonts') }}
      </button>

      <button class="toolbar-button" @click="() => editor.export()">
        <div class="icon i-material-symbols:download-rounded" />
        {{ $t('export') }}
      </button>

      <a v-if="editor.exportResult" :href="editor.exportResult.url" target="_blank" class="button primary">
        {{ editor.exportResult.blob.type }} {{ filesize(editor.exportResult.blob.size) }}
      </a>

      <template v-if="showDebugButtons">
        <button class="toolbar-button" @click="() => (editor._showStats = !editor._showStats)">
          <div
            :class="
              editor._showStats
                ? 'icon i-material-symbols:frame-bug-rounded'
                : 'icon i-material-symbols:frame-bug-outline-rounded'
            "
          />
          {{ $t('Debug') }}
        </button>
      </template>

      <button class="toolbar-button info" @click="() => (state.showInfo = true)">
        <div class="icon i-material-symbols:help-outline-rounded" />
        {{ $t('info') }}
      </button>
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
  border-width: 0;

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
  cursor: pointer;
  border-radius: 0.5rem;

  background-color: transparent;

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

.info {
  margin-left: auto;
}
</style>
