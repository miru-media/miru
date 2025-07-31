---
layout: page
title: AR effects
navbar: false
pageClass: demo-page
---

<script setup lang="ts">
import { useElementSize, useEventListener } from '@vueuse/core'
import { ref, markRaw, onBeforeUnmount, onScopeDispose, watch } from 'vue'

import { EffectPlayer } from 'gltf-ar-effects/player'
import { createSampleGltf } from './ar-effects-demo/sample-gltf'
import EffectCatalog from './ar-effects-demo/effect-catalog.vue'

import environmentOptions from 'virtual:ar-effects-environment-options.js'

import { catalog } from './ar-effects-demo/catalog'

const catalogIsOpen = ref(false)
const video = ref<HTMLVideoElement>()
let stream: MediaStream | undefined
const canvas = ref<HTMLCanvasElement>()
const recordedVideo = ref<HTMLVideoElement>()
const initProgress = ref(0)
const wasStarted = ref(false)
const isReady = ref(false)
const info = ref<any>()
const playerRef = ref<EffectPlayer>()
const isRecording = ref(false)
const isStoppingRecording = ref(false)
const recordedFile = ref<File>()
const recordedBlobUrl = ref('')
const {
  width: canvasWidth,
  height: canvasHeight
} = useElementSize(() => recordedBlobUrl.value ? recordedVideo.value : canvas.value)

const effectUrlParam = import.meta.env.DEV
  ? (new URL(location.href).searchParams.get('effect-url') ?? undefined)
  : undefined
  
const effect = ref(effectUrlParam ? { name: 'Unknown', url: effectUrlParam } : catalog[0])

useEventListener<'progress', any>(playerRef, 'progress', (event) => initProgress.value = event.progress!)
useEventListener<'info', any>(playerRef, 'info', (event)=> info.value = event.info)
useEventListener<'error', any>(playerRef, 'error', window.alert)

watch([video, canvas, effect], async ([video, canvas, effect], _, onCleanup) => {
  if (!video || !canvas) return

    console.log(effect)

  let player = playerRef.value
  let stale = false

  onCleanup(() => {
    stale = true
  })

  const effectData = await createSampleGltf(effect?.url)
  if (stale) return

  if (player) {
    const newPlayer = markRaw(await player.replaceWithNewPlayer(effectData))
    if (stale) newPlayer.dispose()
    else playerRef.value = newPlayer
    return
  }

  player = playerRef.value = markRaw(new EffectPlayer({ video, canvas, environmentOptions }))

  player.loadEffect(effectData)
  if (stale) return

  if (import.meta.env.DEV) await start()
})

onBeforeUnmount(() => playerRef.value?.dispose())

const start = async () => {
  const player = playerRef.value
  if (!player) return

  if (!wasStarted.value) {
    const videoConstraints = { facingMode: 'user', height: 720 }
  
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true })
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
    }

    video.value!.srcObject = stream
  }
  
  wasStarted.value = true
  await player.start()
  isReady.value = true
}

const onClickRecord = async () => {
  const player = playerRef.value!

  if (isRecording.value) {
    player.pause()
    isStoppingRecording.value = true

    const blob = await player.stopRecording()
    const { type } = blob

    recordedFile.value = new File([blob], 'recorded-video.' + (type.includes('webm') ? 'webm' : 'mp4'), { type })
    recordedBlobUrl.value = URL.createObjectURL(recordedFile.value)
    isRecording.value = false
    recordedVideo.value?.classList.remove('canplay')
  } else {
    player.startRecording(stream?.getAudioTracks())
    isRecording.value = true
  }

  isStoppingRecording.value = false
}

const onClickRetake = () => {
  URL.revokeObjectURL(recordedBlobUrl.value)
  recordedFile.value = undefined
  recordedBlobUrl.value = ''
  playerRef.value!.start()
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

<div ref="container" :class="['canvas-container demo-container relative w-full overflow-hidden', !!recordedBlobUrl && 'has-recording']">
  <video ref="video" class="input-video" playsinline muted loop />
  <canvas ref="canvas" class="player-canvas" />
  <template v-if="recordedBlobUrl">
    <video ref="recordedVideo" :src="recordedBlobUrl" class="recorded-video" playsInline controls muted autoplay loop @canplay="onCanplayRecording" />
    <div class="recorded-output-btns">
      <a :href="recordedBlobUrl" title="Download video" target="_blank" :download="recordedFile.name" class="output-btn">
        <span class="i-tabler:download" />
      </a>
      <button title="Retake video" class="icon-btn" @click="onClickRetake"><span class="i-tabler:x" /></button>
    </div>
  </template>
  <template v-else-if="isReady">
    <button v-if="!catalogIsOpen" class="record-btn" :title="isRecording ? 'Stop recording' : 'Start recording'" :disabled="isStoppingRecording" @click="onClickRecord">
      <span class="sr-only">
       {{ isRecording ? 'Stop recording' : 'Start recording' }}
      </span>
      <span :class="['recording-indicator', isRecording && 'is-recording']" />
    </button>
    <template v-if="!isRecording">
      <effect-catalog v-model="effect" v-model:open="catalogIsOpen" >
        <button class="icon-btn catalog-btn" @click="() => catalogIsOpen = !catalogIsOpen">
          <span class="i-tabler:mood-spark"></span>
        </button>
      </effect-catalog>
    </template>
  </template>
</div>

<pre>{{ info }}</pre>

<style scoped>
.progress {
  height: 2rem;
}

.input-video{
  width:1px;
  height:1px;
  position:fixed;
  top:-1px;
  left:-1px
}

.canvas-container {
  position: relative;
  --canvas-width: v-bind("canvasWidth + 'px'");
  --canvas-height: v-bind("canvasHeight + 'px'");
}

.player-canvas, .recorded-video {
  max-width: 100%;
  max-height: var(--demo-height);
  object-fit: contain;
  border-radius: 1.5rem;
  margin: auto;
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
  left: 50%;
  transform: translateX(-50%);
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
  width: var(--canvas-width);
  height: 0;
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: end;
}

.icon-btn {
  display: inline-flex;
  font-size: 4rem;
  height: 6rem;
  background-color: rgba(0 0 0 / 25%);
  border-radius: 50%;
  padding: 1rem;
}

.catalog-btn {
  position: absolute;
  left: 2rem;
  top: -1rem;
  transform: translateY(-100%);
  font-size: 2rem;
  height: 4rem;
  color: yellow;
}
</style>
