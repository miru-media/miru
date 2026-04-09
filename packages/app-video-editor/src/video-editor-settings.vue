<script setup lang="ts">
import { ref, useId } from 'vue'

import { type Size } from 'shared/types'

import { useI18n } from 'vue-i18n-lite'
import type { VideoEditor } from 'webgl-video-editor'

const { editor, onCloseProject } = defineProps<{
  editor: VideoEditor
  onCloseProject?: () => unknown
}>()
const name = defineModel<string>('name')

const { t } = useI18n()
const isOpen = ref(false)
const menuRoot = ref<HTMLElement>()
const resolutionOptions = [
  { value: { width: 1920, height: 1080 }, label: '1920 x 1080' },
  { value: { width: 1080, height: 1920 }, label: '1080 x 1920' },
]

const onBlur = (event: FocusEvent) => {
  const { relatedTarget } = event
  isOpen.value = !!(relatedTarget && menuRoot.value?.contains(relatedTarget as Node))
}

const ids = { menuButton: useId(), menu: useId(), name: useId(), resolution: useId(), frameRate: useId() }
</script>

<template>
  <div class="settings-root">
    <div ref="menuRoot" @blur.capture="onBlur">
      <button
        :id="ids.menuButton"
        class="button overlay square"
        :title="$t('settings')"
        :aria-expanded="isOpen"
        aria-haspopup="true"
        :aria-controls="ids.menu"
        @click="() => (isOpen = !isOpen)"
      >
        <div class="i-tabler-settings" />
        <span class="sr-only">{{ $t('settings') }}</span>
      </button>
      <div :id="ids.menu" role="menu" tabindex="0" :aria-labelledby="ids.menuButton">
        <div role="menuitem">
          <label :for="ids.name">{{ $t('name') }}</label>
          <input :id="ids.name" type="input" v-model="name" />
        </div>
        <div role="menuitem">
          <label :for="ids.resolution">{{ $t('resolution') }}</label>
          <select
            :id="ids.resolution"
            @input="
              (event) =>
                (editor.doc.resolution = JSON.parse((event.target as HTMLInputElement).value) as Size)
            "
            :value="JSON.stringify(editor.doc.resolution)"
          >
            <option v-for="{ value, label } of resolutionOptions" :value="JSON.stringify(value)">
              {{ label }}
            </option>
          </select>
        </div>
        <div role="menuitem">
          <label :for="ids.frameRate">{{ $t('frame_rate') }}</label>
          <select
            :id="ids.frameRate"
            @input="
              (event) => (editor.doc.frameRate = parseInt((event.target as HTMLInputElement).value, 10))
            "
            :value="JSON.stringify(editor.doc.frameRate)"
          >
            <option v-for="value of [24, 25, 30, 48, 50, 60]" :value="value">{{ value }}</option>
          </select>
        </div>
      </div>
    </div>

    <div>
      <button
        v-if="onCloseProject"
        class="button overlay square"
        :title="t('close_project')"
        @click="onCloseProject"
      >
        <div class="i-tabler:x" />
        <span class="sr-only">{{ $t('close_project') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-root {
  display: flex;
  gap: 1rem;
  justify-content: end;
  color: white;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding-left: max(env(safe-area-inset-left, 1.25rem), 1.25rem);
  padding-right: max(env(safe-area-inset-right, 1.25rem), 1.25rem);
  padding-top: max(env(safe-area-inset-top, 1.25rem), 1.25rem);
  padding-bottom: max(env(safe-area-inset-bottom, 1.25rem), 1.25rem);
  pointer-events: none;
  z-index: 1;

  > * > * {
    pointer-events: all;
  }
}

[aria-haspopup='true'] {
  position: relative;
}

[role='menu'] {
  max-inline-size: 30rem;
  display: none;
  flex-direction: column;
  gap: 1rem;
  background-color: #2a2a2a;
  padding: 2rem 1.5rem;
  border-radius: 0.5rem;

  [aria-haspopup='true'] + & {
    position: absolute;
    right: max(env(safe-area-inset-right), 1rem);
  }

  [aria-expanded='true'] + &,
  &:focus,
  &:focus-within {
    display: flex;
  }

  [role='menuitem'] {
    & > label {
      margin-right: 1rem;
    }
  }
}

.button.square {
  aspect-ratio: 1;
  padding: 0.5rem;
  font-size: 1.5rem;
}
</style>
