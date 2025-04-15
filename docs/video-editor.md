---
layout: page
title: Video editor
navbar: false
pageClass: demo-page video-editor-demo-page
---

<script setup lang="ts">
import VideoEditorDemo from './video-editor-demo/video-editor-demo.vue'
</script>

<div class="demo-container">
  <ClientOnly>
    <VideoEditorDemo />
  </ClientOnly>
</div>

<style scoped>
.video-editor {
  height: 100%
}

.demo-video-button {
  position: absolute;
  left: 1rem;
  display: flex;
  gap: 0.675rem;
  align-items: center;
  justify-content: center;
  min-width: var(--clip-height);
  height: var(--clip-height);
  padding: 0.675rem 0.875rem;
  color: var(--white-3);
  cursor: pointer;
  background-color: rgb(255 255 255 / 3%);
  border: dashed;
  border-color: rgb(255 255 255 / 12%);
  border-radius: 0.625rem;
  translate: var(--track-width);

  font-size: 14px;
  font-weight: 500;
  line-height: 17px;
}
</style>
