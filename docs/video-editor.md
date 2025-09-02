---
layout: page
title: Video editor
navbar: false
pageClass: demo-page video-editor-demo-page
---

<script setup lang="ts">
import { VideoEditorApp } from 'app-video-editor'
</script>

<div class="demo-container">
  <ClientOnly>
    <VideoEditorApp class="demo-container" />
  </ClientOnly>
</div>
