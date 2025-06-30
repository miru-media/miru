---
layout: page
title: AR effects
navbar: false
pageClass: demo-page
---

<script setup lang="ts">
import { ref, onMounted, onScopeDispose, watchEffect } from 'vue'

import { createDemo } from './ar-effects-demo/create-demo'
import { createSampleGltf } from './ar-effects-demo/sample-gltf'

const container = ref<HTMLElement>()
const initProgress = ref(0)
const wasStarted = ref(false)
const isReady = ref(false)
const info = ref<any>()
let ar: ReturnType<typeof createDemo>

onMounted(async () => {
  ar = createDemo({
    onInitProgress: (progress) => initProgress.value = progress,
    onInfo: (value)=> info.value = value,
    onError: alert,
    assetUrl: URL.createObjectURL(new Blob([JSON.stringify(await createSampleGltf())]))
  })
  if (import.meta.env.DEV) return start()
})

const start = async () => {
  if (!container.value) return

  container.value.appendChild(ar.renderer.getContext().canvas as HTMLCanvasElement)
  wasStarted.value = true

  if (import.meta.env.DEV) {
    const {video} = ar
    container.value.appendChild(video)
    video.width = 300

    const cv = canvas.value
    const c = cv.getContext('2d')
    cv.style.width = '300px'
  }

  await ar.start()
  isReady.value = true
}

onScopeDispose(() => ar.stop)

const canvas = ref()
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

<div ref="container" class="canvas-container relative w-full overflow-hidden">
</div>

<canvas ref=canvas />
<pre>{{ info }}</pre>

<style>
.progress {
    height: 2rem;
}
.canvas-container canvas {
 max-width:100%; max-height:90vh; object-fit:contain   
}
</style>
