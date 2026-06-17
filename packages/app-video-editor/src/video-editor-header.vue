<script setup lang="ts">
import { filesize } from 'filesize'
import { ref, useId } from 'vue'

import { type Size } from 'shared/types'

import type { VideoEditor } from 'webgl-video-editor'

const { editor } = defineProps<{
  editor: VideoEditor
}>()

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

const ids = { menuButton: useId(), menu: useId(), resolution: useId(), frameRate: useId() }

const exportResult = ref<{ blob: Blob; url: string }>()
const abortExport = ref<AbortController>()

const onClickExport = async () => {
  if (exportResult.value) {
    URL.revokeObjectURL(exportResult.value?.url)
    exportResult.value = undefined
  }

  try {
    abortExport.value = new AbortController()
    const blob = await editor.export({ signal: abortExport.value.signal })
    exportResult.value = { blob, url: URL.createObjectURL(blob) }
  } catch (error) {
    if (abortExport.value?.signal.aborted) return
    console.error(error)
  } finally {
    abortExport.value = undefined
  }
}
</script>

<template>
  <div class="header-root">
    <div>
      <slot name="start"></slot>
    </div>
    <div><slot name="middle" /></div>
    <div>
      <div><slot name="end" /></div>

      <template v-if="exportResult">
        <a :href="exportResult.url" target="_blank" class="button primary px-4 py-2 rounded-lg">
          {{ $t('download') }}
        </a>
        <button
          class="button px-4 py-2 rounded-lg"
          @click="() => (exportResult = undefined)"
          :aria-label="$t('clear')"
        >
          <div class="icon i-material-symbols:close-rounded" />
        </button>
      </template>
      <button
        v-else-if="abortExport"
        class="relative button tertiary px-4 py-2 rounded-lg"
        @click="() => abortExport?.abort()"
      >
        {{ $t('cancel') }}
        <div class="icon i-material-symbols:close-rounded" />
        <progress
          class="absolute bottom-0 left-0 w-full h-0.25rem border-none"
          :value="editor.exportProgress"
        ></progress>
      </button>
      <button v-else class="button primary px-4 py-2 rounded-lg" @click="onClickExport">
        <span :class="editor.isMobileWorkspace && 'sr-only'">{{ $t('export') }}</span>
        <div class="icon i-material-symbols:download-rounded" />
      </button>

      <div ref="menuRoot" @blur.capture="onBlur">
        <button
          :id="ids.menuButton"
          class="button px-4 py-2 rounded-lg"
          :aria-expanded="isOpen"
          aria-haspopup="true"
          :aria-controls="ids.menu"
          @click="() => (isOpen = !isOpen)"
        >
          <span :class="editor.isMobileWorkspace && 'sr-only'">{{ $t('settings') }}</span>
          <div class="i-material-symbols:settings-outline-rounded" />
        </button>
        <div :id="ids.menu" role="menu" tabindex="0" :aria-labelledby="ids.menuButton">
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
    </div>
  </div>
</template>

<style scoped>
.header-root {
  position: relative;
  display: grid;
  grid-template-columns: 1fr minmax(auto, 1fr) 1fr;
  justify-content: end;
  padding-left: max(env(safe-area-inset-left, 0.5rem), 0.5rem);
  padding-right: max(env(safe-area-inset-right, 0.5rem), 0.5rem);
  padding-top: max(env(safe-area-inset-top, 0.5rem), 0.5rem);
  padding-bottom: max(env(safe-area-inset-bottom, 0.5rem), 0.5rem);

  > * {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  & > :first-child {
    justify-self: start;
  }

  & > :last-child {
    justify-self: end;
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
  z-index: 1;

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

.export-progress {
  position: absolute;
  bottom: -0.5rem;
  left: 0;
  width: 100%;
}

.hidden {
  display: none;
}
</style>
