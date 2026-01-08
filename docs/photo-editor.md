---
layout: page
title: Photo editor
navbar: false
pageClass: demo-page
---

<script setup lang="ts">
import 'webgl-media-editor'
import { type MediaEditorElement } from 'webgl-media-editor'
import { useData } from 'vitepress'

import { downloadBlob } from 'shared/utils/general'

import { ref, onScopeDispose } from 'vue'

const { isDark } = useData()
const editor = ref<MediaEditorElement>()
const inputFile = ref<File>()

function onInputFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !editor.value) return

  inputFile.value = file
  editor.value.sources = [file]
  target.value = ''
}

async function onClickDownload() {
  if (!editor.value) return
  await downloadBlob(await editor.value.toBlob(0), 'edit-' + inputFile.value!.name)
}

const errorText = ref('' as string)
if (!import.meta.env.SSR) {
  window.onerror = (event, ...args) => {
    errorText.value = [event.toString(), (args[2] as unknown as Error)?.stack].filter(Boolean).join('\n')
  }

  onScopeDispose(() => window.onerror = null)
}
</script>

<div class="demo-container m-0">
  <div class="flex flex-col w-full h-full max-w-1440px m-auto overflow-hidden">
    <div class="flex flex-1 px-4 gap-2rem min-h-0">
      <div class="flex flex-col overflow-auto flex-1 min-w-0 min-h-0 gap-12px">
        <media-editor ref="editor" class="min-h-0 flex-1 h-full max-w-600px m-auto"
          :color-scheme="isDark ? 'dark' : 'light'"></media-editor>
        <div class="flex">
          <label
            class="flex flex-grow-0 justify-center items-center mx-auto px-2 py-1 cursor-pointer border-solid border-2 rounded-lg">
            Change image
            <div class="i-tabler:photo text-2rem"></div>
            <input type="file" accept="image/*" @input="onInputFile" class="max-w-0" hidden />
          </label>
          <button v-if="inputFile"
            class="flex flex-grow-0 justify-center items-center mx-auto px-2 py-1 cursor-pointer border-solid border-2 rounded-lg font-size-inherit"
            @click="onClickDownload">
            Download <div class="i-tabler-download text-2rem"></div>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
