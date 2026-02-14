<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import type { Reactive } from 'vue'
import { type WebglEffectsMenuElement } from 'webgl-media-editor'
import 'webgl-media-editor'

import sampleImage from 'shared/assets/320px-bianchi.jpg'
import { fit, useEventListener } from 'shared/utils'

import type { VideoEditor } from 'webgl-video-editor'
import type { Clip } from '../../webgl-video-editor/src/nodes'
import { NodeUpdateEvent } from '../../webgl-video-editor/src/events'

const { editor } = defineProps<{ editor: Reactive<VideoEditor> }>()

const onChange = (event: CustomEvent<{ effect: string | undefined; intensity: number }>) => {
  const clip = editor.selection
  if (!clip) return

  const { effect, intensity } = event.detail
  const prevFilter = clip.filter
  const newFilter = effect ? { assetId: effect, intensity } : undefined

  if (prevFilter && prevFilter.assetId === effect) {
    editor._editor._untracked(() => (clip.filter = newFilter))
    const node = editor._editor._movie.nodes.get<Clip>(clip.id)
    node.root._emit(new NodeUpdateEvent(node, { filter: prevFilter }, 'filter'))
  } else clip.filter = newFilter

  const { start, end } = clip._presentationTime
  const { currentTime } = editor

  if (currentTime < start || currentTime >= end) editor.seekTo(start)
}

const texture = editor.effectRenderer.createTexture()
const isLoadingTexture = ref(true)
const img = new Image()
useEventListener(img, 'load', () => {
  isLoadingTexture.value = false
  editor.effectRenderer.loadImage(texture, img)
})

img.src = sampleImage
onScopeDispose(() => img.removeAttribute('src'))

const menu = ref<WebglEffectsMenuElement>()

watch(
  () => editor.selection,
  () => menu.value?.scrollToEffect(editor.selection?.filter?.assetId, 'instant'),
)
</script>

<template>
  <webgl-effects-menu
    ref="menu"
    :sourceTexture="texture"
    :sourceSize="img"
    :thumbnailSize="fit(img, { width: 200, height: 200 })"
    :renderer="editor.effectRenderer"
    :effects="editor.effects"
    :effect="editor.selection?.filter?.assetId"
    :intensity="editor.selection?.filter?.intensity ?? 1"
    :loading="isLoadingTexture"
    @change="onChange"
    class="filters-menu"
  />
</template>
