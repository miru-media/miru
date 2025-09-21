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
import { type LoadInfo, type TrimState } from 'media-trimmer'

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

<div class="demo-container video-trimmer-demo">
  <media-trimmer
    class="block w-full p-0.5rem box-border"
    :source="source"
    :state="state"
    :onChange="onChange"
    :onLoad="onLoad"
    :onError="onError"
  ></media-trimmer>

  <progress class="bulma-progress w-full border-0" :value="progress" max="1" />
    <div class="bulma-field bulma-is-grouped">
      <label :class="['bulma-button', !source && 'bulma-is-primary']">
      <div class="bulma-icon i-tabler:upload"></div>
      <span > Choose a file </span>
      <input type="file" name="video source" accept="video/*" :onInput="onInputFile" hidden />
      </label>
      <div class="control">
      <button
        v-if="source"
        :class="['bulma-button', !resultUrl && 'bulma-is-primary']"
        :onClick="exportVideo"
      >
        Export
      </button>
      </div>
    <div class="control">
      <a
        class="bulma-button bulma-is-success"
        v-if="resultUrl"
        :href="resultUrl"
        target="_blank"
        :download="`trimmed${inputFile ? '-' + inputFile.name : ''}.mp4`"
      >
          <div class="icon i-tabler:download"></div>
        Download
      </a>
    </div>
  </div>
  <video
    :src="resultUrl"
    height="300"
    autoplay="true"
    playsInline
    controls
    :class="!resultUrl && 'hidden'"
  />
</div>
