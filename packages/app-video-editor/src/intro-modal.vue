<script setup lang="ts">
import { useLocalStorage, useAsyncState } from '@vueuse/core'
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n-lite'

const INFO_VERSION = 1

const { current: currentLocale } = useI18n()
const { state: ContentComponent, executeImmediate: updateContent } = useAsyncState(
  async () => {
    if (currentLocale.value === 'de') return import('./intro-modal-content.de.md').then((m) => m.default)
    return import('./intro-modal-content.en.md').then((m) => m.default)
  },
  undefined,
  { immediate: true },
)
const hasShownIntro = useLocalStorage('video-editor:has-shown-intro-modal', 0)

const dialog = ref<HTMLDialogElement>()

if (hasShownIntro.value < INFO_VERSION) {
  onMounted(() => {
    dialog.value?.showModal()
  })
}

const onCloseDialog = () => {
  hasShownIntro.value = INFO_VERSION
}

watch(currentLocale, updateContent)
</script>

<template>
  <dialog
    ref="dialog"
    closedby="none"
    class="video-editor-intro-modal bulma-modal"
    @close="onCloseDialog"
    @cancel="onCloseDialog"
    style="color: var(--bulma-body-color)"
  >
    <content-component v-if="ContentComponent" class="bulma-modal-card">
      <template #header="{ title }">
        <div class="bulma-columns bulma-is-vcentered">
          <div class="bulma-column">
            <h2 class="bulma-modal-card-title">
              <picture>
                <source
                  srcset="../../../docs/branding/logo/white-logo.svg"
                  media="(prefers-color-scheme: dark)"
                />
                <img alt="Miru" src="../../../docs/branding/logo/dark-logo.svg" class="logo" />
              </picture>
              {{ title }}
            </h2>
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
.video-editor-intro-modal {
  color-scheme: dark light;
  &:focus {
    outline: none;
  }

  .bulma-modal-card-title {
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
}
</style>
