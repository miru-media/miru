<script setup lang="ts">
import 'media-trimmer'
import { ref, watchEffect } from 'vue'
import { MediaTrimmerElement, trim } from 'media-trimmer'
import type { TrimEvent } from 'media-trimmer/elements'

const trimmer = ref<MediaTrimmerElement>()
const source = ref('')

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
  if (!trimmer.value?.duration) return
  const { start, end, mute } = trimmer.value

  try {
    trimmedBlob.value = await trim(source.value, {
      start,
      end,
      mute,
      onProgress: (value) => (progress.value = value),
    })
  } catch (error) {
    alert(error)
  }
}

const onClickBack = () => {
  if ((navigator as Navigator & { canGoBack: boolean }).canGoBack) history.back()
  else {
    window.close()
    location.href = '/demos/'
  }
}

const onChange = (event: TrimEvent) => {
  const { start, end } = event.trimmer
  console.log(event.type, start, end)
}

const onLoad = (event: TrimEvent) => {
  const { duration, hasAudio } = event.trimmer
  console.log(event.type, duration, hasAudio)
}

const onError = (event: ErrorEvent) => console.error(event.error)

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

<template>
  <div v-if="source">
    <media-trimmer
      ref="trimmer"
      class="block w-full p-0.5rem box-border"
      :source="source"
      @change="onChange"
      @load="onLoad"
      @error="onError"
    />

    <progress class="w-full border-0" :value="progress" max="1" />
    <div class="flex justify-evenly">
      <button class="button tertiary" @click="() => (source = '')">
        <div class="i-tabler:x text-2rem"></div>
        Cancel
      </button>
      <button :class="['button', !resultUrl && 'primary']" @click="exportVideo">Export</button>
      <a
        class="button primary"
        v-if="resultUrl"
        :href="resultUrl"
        target="_blank"
        :download="`trimmed${inputFile ? '-' + inputFile.name : ''}.mp4`"
      >
        <div class="icon i-tabler:download"></div>
        Download
      </a>
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
  <div v-else>
    <img src="../media/illustrations/2.svg" alt="" class="w-full max-w-50vw max-h-50vh block m-auto" />
    <div class="flex justify-center gap-10 p-10">
      <button id="back-button" class="button tertiary" @click="onClickBack">
        <div class="i-tabler:chevron-left text-2rem"></div>
        Back
      </button>
      <label id="file-button" class="button primary">
        <div class="i-tabler:photo text-2rem"></div>
        Choose a file
        <input type="file" name="video source" accept="video/*" @input="onInputFile" hidden />
      </label>
    </div>
  </div>
</template>

<style scoped>
media-trimmer {
  --clip-selected-color-accent: hsl(216deg 79% 50%);
  --clip-selected-color-text: white;
}
</style>
