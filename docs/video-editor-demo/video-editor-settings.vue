<script setup lang="ts">
import { ref } from 'vue'

import { type Size } from 'shared/types'
import { useEventListener } from 'shared/utils'

import { type VideoEditor } from 'webgl-video-editor'

const { editor } = defineProps<{ editor: VideoEditor }>()

const isOpen = ref(false)
const root = ref<HTMLElement>()
const resolutionOptions = [
  { value: { width: 1920, height: 1080 }, label: '1920 x 1080' },
  { value: { width: 1080, height: 1920 }, label: '1080 x 1920' },
]

useEventListener(
  () => root.value?.getRootNode(),
  'pointerdown',
  (event) => {
    if (!isOpen.value || !root.value) return
    if (!event.composedPath().includes(root.value)) isOpen.value = false
  },
)

const onClickClearAll = async (prompt: string) => {
  if (!window.confirm(prompt)) return
  await editor.clearAllContentAndHistory()
  isOpen.value = false
}
</script>

<template>
  <div ref="root" :class="['settings-controls safe-padding-x', isOpen && 'is-open']">
    <button class="toolbar-button settings-button" @click="() => (isOpen = !isOpen)" :title="$t('settings')">
      <div class="icon i-tabler-settings overlay" />
      <span class="sr-only">{{ $t('settings') }}</span>
    </button>

    <div class="settings-content">
      <label>
        {{ $t('resolution') }}
        <select
          class="settings-resolution"
          @input="
            (event) => (editor.resolution = JSON.parse((event.target as HTMLInputElement).value) as Size)
          "
          :value="JSON.stringify(editor.resolution)"
        >
          <option v-for="{ value, label } of resolutionOptions" :value="JSON.stringify(value)">
            {{ label }}
          </option>
        </select>
      </label>
      <label>
        {{ $t('frame_rate') }}
        <select
          class="settings-frame-rate"
          @input="(event) => (editor.frameRate = parseInt((event.target as HTMLInputElement).value, 10))"
          :value="JSON.stringify(editor.frameRate)"
        >
          <option v-for="value of [24, 25, 30, 48, 50, 60]" :value="value">{{ value }}</option>
        </select>
      </label>

      <button
        class="toolbar-button"
        :title="$t('settings')"
        type="button"
        @click="() => onClickClearAll($t('confirm_delete_all_content'))"
      >
        <div class="icon i-tabler-trash" />
        &nbsp;{{ $t('delete_all_content') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-controls {
  color: var(--white);
  position: absolute;
  top: 0;
  right: max(env(safe-area-inset-p, 1.25rem), 1.25rem);
  display: flex;
  justify-content: right;
  padding-top: max(env(safe-area-inset-p, 1.25rem), 1.25rem);
  padding-bottom: max(env(safe-area-inset-bottom, 1.25rem), 1.25rem);
}

.settings-content {
  position: absolute;
  top: 4rem;
  z-index: 10;
  display: none;
  flex-direction: column;
  gap: 1rem;
  min-width: 14rem;
  padding: 1rem;
}

.settings-button,
.settings-content {
  background-color: var(--primary-bg-05);
  border-radius: 0.5rem;
}

.settings-controls.is-open .settings-content {
  display: flex;
}

.toolbar-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 0.5rem;
  align-self: stretch;
  justify-content: flex-start;
  font-size: 0.75rem;
  line-height: initial;
  text-align: center;

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

.settings-button {
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.25rem;
  justify-content: center;
}

.settings-frame-rate,
.settings-resolution {
  padding: 0.5rem;
}
</style>
