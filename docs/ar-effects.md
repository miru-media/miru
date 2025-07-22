---
layout: page
title: AR effects
navbar: false
pageClass: demo-page
---

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { ref, markRaw, onMounted, onScopeDispose, watchEffect } from 'vue'

import { EffectPlayer } from 'gltf-ar-effects/player'
import { createSampleGltf } from './ar-effects-demo/sample-gltf'

const canvas = ref<HTMLCanvasElement>()
const recordedVideo = ref<HTMLVideoElement>()
const initProgress = ref(0)
const wasStarted = ref(false)
const isReady = ref(false)
const info = ref<any>()
const playerRef = ref<EffectPlayer>()
const isRecording = ref(false)
const isStoppingRecording = ref(false)
const recordedBlobUrl = ref('')
const { width: canvasWidth } = useElementSize(() => recordedBlobUrl.value ? recordedVideo.value : canvas.value)

onMounted(async () => {
  if (!canvas.value) throw new Error('No canvas')
  const player = playerRef.value = markRaw(new EffectPlayer({ canvas: canvas.value }))

  player.addEventListener('progress', (event) => initProgress.value = event.progress!)
  player.addEventListener('info', (event)=> info.value = event.info)
  player.addEventListener('error', window.alert)

  player.loadUrl(URL.createObjectURL(new Blob([JSON.stringify(await createSampleGltf())])))

  if (import.meta.env.DEV) return start()
})

const start = async () => {
  const player = playerRef.value
  if (!player) return

  wasStarted.value = true
  await player.init()
  isReady.value = true
}

const onClickRecord = async () => {
  const player = playerRef.value!

  if (isRecording.value) {
    player.pause()
    isStoppingRecording.value = true
    recordedBlobUrl.value = URL.createObjectURL(await player.stopRecording())
    isRecording.value = false
    recordedVideo.value?.classList.remove('canplay')
  } else {
    player.startRecording()
    isRecording.value = true
  }

  isStoppingRecording.value = false
}

const onClickRetake = () => {
  URL.revokeObjectURL(recordedBlobUrl.value)
  recordedBlobUrl.value = ''
  playerRef.value!.play()
}

const onCanplayRecording = () => recordedVideo.value!.classList.add('canplay')

onScopeDispose(() => playerRef.value?.dispose())

</script>

<div v-if="!wasStarted" class="flex flex-col gap-5 m-4rem">
  <h1 class="text-3xl">This is a demonstration of 3D AR filters.</h1>

  <p>Click the button below to start your device's camera to try out a filter.</p>

  <p class="tip custom-block">
    Your video stays on your device. No images are uploaded to any server.
  </p>

<button @click="start" class="text-xl inline-block p-0.5rem border-solid border-2px border-currentColor rounded-2">Start camera 📹</button>

</div>

<progress v-else-if="!isReady" :value="initProgress" max="1" class="progress w-full" />

<div ref="container" :class="['canvas-container relative w-full overflow-hidden', !!recordedBlobUrl && 'has-recording']">
  <canvas ref="canvas" class="player-canvas" />
  <template v-if="recordedBlobUrl">
    <video ref="recordedVideo" :src="recordedBlobUrl" class="recorded-video" playsInline controls muted autoplay @canplay="onCanplayRecording" />
    <div class="recorded-output-btns">
      <a :href="recordedBlobUrl" title="Download video" target="_blank" download="recording" class="output-btn">
        <span class="i-tabler:download" />
      </a>
      <button title="Retake video" class="output-btn" @click="onClickRetake"><span class="i-tabler:x" /></button>
    </div>
  </template>
  <button v-else-if="isReady" class="record-btn" :title="isRecording ? 'Stop recording' : 'Start recording'" :disabled="isStoppingRecording" @click="onClickRecord">
    <span class="sr-only">
     {{ isRecording ? 'Stop recording' : 'Start recording' }}
    </span>
    <span :class="['recording-indicator', isRecording && 'is-recording']" />
  </button>
</div>

<pre>{{ info }}</pre>

<style scoped>
.progress {
  height: 2rem;
}
.canvas-container {
  position: relative;
}

.player-canvas, .recorded-video {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
}

.has-recording {
  .player-canvas, .record-btn {
    display: none;
  }
}

.recorded-video:not(.canplay) {
  display: none;
}

.record-btn {
  position: absolute;
  bottom: 1rem;
  left: 0;
  transform: translateX(v-bind("canvasWidth / 2 + 'px'")) translateX(-50%);
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  border: solid 0.365rem white;
  padding: 1rem;
  background-color: rgba(0 0 0 / 12.5%)
}

.recording-indicator {
  position: absolute;
  inset: 0;
  background-color: red;
  border-radius: 50%;
  transform: scale(0.5);

  transition: all 0.25s;

  &.is-recording {
    border-radius: 0.875rem;
    transform: scale(0.675);
  }
}

.recorded-output-btns {
  position: absolute;
  left: 0;
  bottom: 5rem;
  width: v-bind("canvasWidth + 'px'");
  height: 0;
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: end;
}

.output-btn {
  display: inline-flex;
  font-size: 4rem;
  height: 6rem;
  background-color: rgba(0 0 0 / 25%);
  border-radius: 50%;
  padding: 1rem;
}
</style>
