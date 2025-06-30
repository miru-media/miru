<script setup lang="ts">
import { onScopeDispose, ref, watch, Reactive } from 'vue'
import { type WebglEffectsMenuElement } from 'webgl-media-editor'
import 'webgl-media-editor'

import sampleImage from 'shared/assets/320px-bianchi.jpg'
import { fit, useEventListener } from 'shared/utils'

import { VideoEditor } from 'webgl-video-editor'

const { editor } = defineProps<{ editor: Reactive<VideoEditor> }>()

const onChange = (event: CustomEvent<{ effect: string | undefined; intensity: number }>) => {
  const clip = editor.selection
  if (!clip) return

  const { effect, intensity } = event.detail
  editor.setClipFilter(clip, effect, intensity)

  const { start, end } = clip._presentationTime
  const { currentTime } = editor

  if (currentTime < start || currentTime >= end) editor.seekTo(start)
}

const texture = editor.renderer.createTexture()
const isLoadingTexture = ref(true)
const img = new Image()
useEventListener(img, 'load', () => {
  isLoadingTexture.value = false
  editor.renderer.loadImage(texture, img)
})

img.src = sampleImage
onScopeDispose(() => img.removeAttribute('src'))

const menu = ref<WebglEffectsMenuElement>()

console.log(editor)

watch(
  () => editor.selection,
  () => menu.value?.scrollToEffect(editor.selection?.filter?.id, 'instant'),
)
</script>

<template>
  <webgl-effects-menu
    ref="menu"
    :sourceTexture="texture"
    :sourceSize="img"
    :thumbnailSize="fit(img, { width: 200, height: 200 })"
    :renderer="editor.renderer"
    :effects="editor.effects"
    :effect="editor.selection?.filter?.id"
    :intensity="editor.selection?.filter?.intensity ?? 1"
    :loading="isLoadingTexture"
    @change="onChange"
    class="filters-menu"
  />
</template>
