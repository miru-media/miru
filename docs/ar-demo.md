---
layout: page
title: AR demo
navbar: false
pageClass: demo-page
---
<script setup lang="ts">
import { ref, onMounted, onScopeDispose, watchEffect } from 'vue'

import { createDemo } from 'ar-effects/src'
import { createSampleGltf } from './ar-demo/sample-gltf'


const container = ref<HTMLElement>()
const initProgress = ref(0)
const started = ref(false)
const info = ref<any>()
let ar

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
    started.value = true

    if (import.meta.env.DEV) {
      const {video} = ar
      container.value.appendChild(video)
      video.width = 300

      const cv = canvas.value
      const c = cv.getContext('2d')
      cv.style.width = '300px'
    }

    await ar.start()
}

onScopeDispose(() => ar.stop)

const canvas = ref()
</script>

<button @click="start" v-if="!started" class="text-xl inline-block p-8px border-solid border-4px border-currentColor">START 📹</button>
<progress v-if="initProgress !== 1" :value="initProgress" max="1" class="progress" />

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