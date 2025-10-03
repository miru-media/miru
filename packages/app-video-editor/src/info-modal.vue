<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n-lite'
import { state } from './state'

const INFO_VERSION = 1

const { current: currentLocale } = useI18n()
const { state: ContentComponent, executeImmediate: updateContent } = useAsyncState(
  async () => {
    if (currentLocale.value === 'de') return import('./info-modal-content.de.md').then((m) => m.default)
    return import('./info-modal-content.en.md').then((m) => m.default)
  },
  undefined,
  { immediate: true },
)
const dialog = ref<HTMLDialogElement>()

state.showInfo = state.hasSeenIntro < INFO_VERSION

watchEffect(() => {
  if (state.showInfo) dialog.value?.showModal()
})

const onCloseDialog = () => {
  state.hasSeenIntro = INFO_VERSION
  state.showInfo = false
}

watch(currentLocale, updateContent)
</script>

<template>
  <dialog
    ref="dialog"
    class="video-editor-info-modal bulma-modal"
    @close="onCloseDialog"
    @cancel="onCloseDialog"
    style="color: var(--bulma-body-color)"
  >
    <content-component v-if="ContentComponent" class="bulma-modal-card">
      <template #header="{ title }">
        <div class="bulma-columns bulma-is-vcentered">
          <div class="bulma-column bulma-content">
            <h1 class="title" :aria-label="'Miru | ' + title">
              <picture>
                <source
                  srcset="../../../docs/branding/logo/white-logo.svg"
                  media="(prefers-color-scheme: dark)"
                />
                <img alt="logo" src="../../../docs/branding/logo/dark-logo.svg" class="logo" />
              </picture>
              {{ title }}
            </h1>
          </div>
          <div class="bulma-column">
            <img src="../../../docs/branding/illustrations/2.svg" class="illustration" alt="" />
          </div>
        </div>
      </template>
      <template #confirm="{ text }">
        <footer class="bulma-modal-card-foot bulma-is-justify-content-end">
          <button class="bulma-button bulma-is-success" @click="() => dialog?.close()">
            {{ text }}
          </button>
        </footer>
      </template>
    </content-component>
  </dialog>
</template>

<style>
.video-editor-info-modal {
  color-scheme: dark light;
  &:focus {
    outline: none;
  }

  .title {
    text-align: center;
    align-items: center;
  }

  .bulma-modal-card-body {
    border-start-start-radius: var(--bulma-modal-card-head-radius);
    border-start-end-radius: var(--bulma-modal-card-head-radius);
  }

  .logo {
    margin: auto;
    margin-bottom: 1rem;
    height: 3rem;
  }

  .illustration {
    height: 20rem;
    max-height: 32vh;
    margin: auto;
    margin-top: -1rem;
  }

  .bulma-content {
    margin: 0;
  }

  .task-list {
    list-style: none;
    margin-inline-start: 1em;
  }
}
</style>
