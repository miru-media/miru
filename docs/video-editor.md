---
layout: false
title: Video editor
navbar: false
---

<script setup lang="ts">
import { useRouter } from 'vitepress'
import { VideoEditorApp } from 'app-video-editor'

const router = useRouter()
</script>

<div >
  <ClientOnly>
    <VideoEditorApp :onCloseProject="() => router.go('/')" />
  </ClientOnly>
</div>
