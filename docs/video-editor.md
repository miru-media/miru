---
layout: page
---

<script setup lang="ts">
import { mountDemo } from 'miru-video-editor/demo'
import { ref, watchEffect } from 'vue'

const videoEditorContainer = ref<HTMLElement>()

if (!import.meta.env.SSR) {
  watchEffect((onCleanup) => {
    const container = videoEditorContainer.value
    if (!container) return

    const unmountDemo = mountDemo(container)
    onCleanup(unmountDemo)
  })
}
</script>

<div ref="videoEditorContainer" class="demo-container" />
