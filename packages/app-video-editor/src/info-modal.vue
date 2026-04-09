<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n-lite'
import { state } from './state'

const INFO_VERSION = 1

const { current: currentLocale } = useI18n()
const { state: ContentComponent, executeImmediate: updateContent } = useAsyncState(
  async () => {
    if (currentLocale.value === 'de') return import('./info-modal-content.de.vue').then((m) => m.default)
    return import('./info-modal-content.en.vue').then((m) => m.default)
  },
  undefined,
  { immediate: true },
)
const dialog = ref<HTMLDialogElement>()

state.showInfo = state.hasSeenIntro < INFO_VERSION

watchEffect(() => {
  if (state.showInfo) {
    dialog.value?.showModal()
    dialog.value?.classList.add('open')
  }
})

const onCloseDialog = () => {
  state.hasSeenIntro = INFO_VERSION
  state.showInfo = false
  dialog.value?.classList.remove('open')
}

watch(currentLocale, updateContent)
</script>

<template>
  <dialog ref="dialog" class="dialog" @close="onCloseDialog" @cancel="onCloseDialog">
    <div class="dialog-content prose dark:prose-invert">
      <content-component v-if="ContentComponent">
        <template #header="{ title }">
          <div class="not-prose title">
            <h1 class="prose-lg dark:prose-invert" :aria-label="'Miru | ' + title">
              <picture>
                <source
                  srcset="../../../website/content/media/logo/white-logo.svg"
                  media="(prefers-color-scheme: dark)"
                />
                <img alt="logo" src="../../../website/content/media/logo/dark-logo.svg" class="logo" />
              </picture>
              {{ title }}
            </h1>
            <img src="../../../website/content/media/illustrations/2.svg" class="illustration" alt="" />
          </div>
        </template>
        <template #confirm="{ text }">
          <footer>
            <button class="button primary" @click="() => dialog?.close()">
              {{ text }}
            </button>
          </footer>
        </template>
      </content-component>
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  border: none;
  border-radius: 1rem;
  padding: 2rem 2rem 0;

  &:focus {
    outline: none;
  }

  &::backdrop {
    background-color: #000a;
  }
}

.dialog-content {
  color-scheme: dark light;
  position: relative;
  flex-direction: column;
  background-color: inherit;
  align-items: stretch;

  .title {
    text-align: center;
    align-items: center;
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

  :global(.task-list li) {
    padding: 0;
    list-style: none;
    margin: 0;
  }

  footer {
    display: flex;
    position: sticky;
    background-color: inherit;
    /* 0px left a gap in firefox  */
    bottom: -1px;
    justify-content: end;
    padding: 2rem 0;
  }
}
</style>
