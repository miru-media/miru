---
layout: page
title: Video trimmer
navbar: false
pageClass: demo-page
---

<script setup lang="ts">
import 'media-trimmer'
import { ref, watchEffect } from 'vue'
import { trim } from 'media-trimmer'
import { type LoadInfo, type TrimState } from './VideoTrimmerUI'

const videoEditorContainer = ref<HTMLElement>()

const source = ref('')
const state = ref<TrimState>()

const progress = ref(0)
const trimmedBlob = ref<Blob>()
const resultUrl = ref<string>()

watchEffect((onCleanup) => {
  const blob = trimmedBlob.value
  const blobUrl = (resultUrl.value = blob ? URL.createObjectURL(blob) : '')
  resultUrl.value = blobUrl
  onCleanup(() => URL.revokeObjectURL(blobUrl))
})

const exportVideo = async () => {
  trimmedBlob.value = undefined
  if (!state.value) return

  try {
    trimmedBlob.value = await trim(source.value, {
      ...state.value,
      onProgress: (value) => (progress.value = value),
    })
  } catch (error) {
    alert(error)
  }
}

const onChange = (event: CustomEvent<TrimState>) => {
  console.log(event.type, event.detail)
  state.value = event.detail
}

const onLoad = (event: CustomEvent<LoadInfo>) => {
  console.log(event.type, event.detail)
  state.value = { start: 0, end: event.detail.duration, mute: false }
}

const onError = (event: CustomEvent<unknown>) => console.error(event.detail)

const inputFile = ref<File>()
const onInputFile = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    inputFile.value = file
    URL.revokeObjectURL(source.value)
    source.value = URL.createObjectURL(file)
  }
}
</script>

<div class="demo-container">
  <media-trimmer
    class="block w-full p-0.5rem box-border"
    :source="source"
    :state="state"
    :onChange="onChange"
    :onLoad="onLoad"
    :onError="onError"
  ></media-trimmer>
  <progress class="block w-full border-0" :value="progress" max="1" />
  <div class="flex items-center">
    <input
      type="file"
      accept="video/*"
      :onInput="onInputFile"
    />
    <button
      type="button"
      :onClick="exportVideo"
      :disabled="() => !state.value"
      style="padding: 1rem; border: solid white"
    >
      Export
    </button>
        <a
          v-if="resultUrl"
          :href="resultUrl"
          target="_blank"
          :download="`trimmed${inputFile ? '-' + inputFile.name : ''}.mp4`"
        >
          Download
        </a>

  </div>
  <video
    :src="resultUrl"
    height="300"
    autoplay="true"
    controls
    :class="!resultUrl && 'hidden'"
  />
</div>

<div ref="videoEditorContainer" class="demo-container" />
