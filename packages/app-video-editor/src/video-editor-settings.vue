<script setup lang="ts">
import { ref } from 'vue'

import { type Size } from 'shared/types'

import { useI18n } from 'vue-i18n-lite'
import type { VideoEditor } from 'webgl-video-editor'

const { editor, onCloseProject } = defineProps<{ editor: VideoEditor; onCloseProject?: () => unknown }>()

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

const onClickClearAll = async (prompt: string) => {
  if (!window.confirm(prompt)) return
  await editor.clearAllContentAndHistory()
  isOpen.value = false
}
</script>

<template>
  <div class="bulma-level bulma-is-mobile settings-root">
    <div class="bulma-level-left">
      <button
        v-if="onCloseProject"
        class="bulma-button overlay"
        :title="t('close_project')"
        :aria-label="t('close_project')"
        @click="onCloseProject"
      >
        <div class="bulma-icon i-tabler:x" />
      </button>
    </div>

    <div ref="menuRoot" class="bulma-level-right" @blur.capture="onBlur">
      <div class="bulma-level-item">
        <div :class="['bulma-dropdown bulma-is-right', isOpen && 'bulma-is-active']">
          <div class="bulma-dropdown-trigger">
            <button
              class="bulma-button overlay"
              @click="() => (isOpen = !isOpen)"
              :title="$t('settings')"
              :aria-label="$t('settings')"
              aria-haspopup="true"
              aria-controls="dropdown-menu6"
            >
              <div class="bulma-icon i-tabler-settings" />
            </button>
          </div>
          <div class="bulma-dropdown-menu" id="dropdown-menu6" role="menu">
            <div class="bulma-dropdown-content" tabindex="0">
              <div class="bulma-dropdown-item">
                <div class="bulma-label">{{ $t('resolution') }}</div>
                <div class="bulma-select">
                  <select
                    @input="
                      (event) =>
                        (editor.resolution = JSON.parse((event.target as HTMLInputElement).value) as Size)
                    "
                    :value="JSON.stringify(editor.resolution)"
                  >
                    <option v-for="{ value, label } of resolutionOptions" :value="JSON.stringify(value)">
                      {{ label }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="bulma-dropdown-item">
                <div class="bulma-label">{{ $t('frame_rate') }}</div>
                <div class="bulma-select">
                  <select
                    @input="
                      (event) => (editor.frameRate = parseInt((event.target as HTMLInputElement).value, 10))
                    "
                    :value="JSON.stringify(editor.frameRate)"
                  >
                    <option v-for="value of [24, 25, 30, 48, 50, 60]" :value="value">{{ value }}</option>
                  </select>
                </div>
              </div>
              <hr />
              <div class="bulma-dropdown-item">
                <button class="bulma-button" @click="() => onClickClearAll($t('confirm_delete_all_content'))">
                  <div class="bulma-icon i-tabler-trash" />
                  &nbsp;<span>{{ $t('delete_all_content') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-root {
  color: white;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding-left: max(env(safe-area-inset-left, 1.25rem), 1.25rem);
  padding-right: max(env(safe-area-inset-right, 1.25rem), 1.25rem);
  padding-top: max(env(safe-area-inset-top, 1.25rem), 1.25rem);
  padding-bottom: max(env(safe-area-inset-bottom, 1.25rem), 1.25rem);
}
</style>
