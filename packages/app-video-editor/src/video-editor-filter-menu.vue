<script setup lang="ts">
import { markRaw, onScopeDispose, ref, watch } from 'vue'
import { type WebglEffectsMenuElement } from 'webgl-media-editor'
import 'webgl-media-editor'

import sampleImage from 'shared/assets/320px-bianchi.jpg'
import { fit, useEventListener } from 'shared/utils'

import type { VideoEditor } from 'webgl-video-editor'
import { Effect } from 'reactive-effects/effect'

const { editor } = defineProps<{ editor: VideoEditor }>()
const effects = ref(new Map<string, Effect>())

watch(
  [() => editor.effects],
  ([effectAssets], _pref, onCleanup) => {
    effects.value = new Map(
      Array.from(effectAssets).map(([id, effect]) => [
        id,
        markRaw(new Effect(effect.raw, editor.effectRenderer as any)),
      ]),
    )

    onCleanup(() => effects.value.forEach((e) => e.dispose()))
  },
  { immediate: true },
)

const onChange = (event: CustomEvent<{ effect: string | undefined; intensity: number }>) => {
  const clip = editor.selection
  if (!clip?.isVideo()) return

  const { effect, intensity } = event.detail
  const newFilter = effect
    ? { id: clip.effects[0]?.id ?? editor.generateId(), assetId: effect, intensity }
    : undefined

  clip.effects = newFilter ? [newFilter] : []

  const start = clip.time.start
  const end = start + clip.duration
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
  () =>
    editor.selection?.isVideo() &&
    menu.value?.scrollToEffect(editor.selection.effects?.[0]?.assetId, 'instant'),
)
</script>

<template>
  <webgl-effects-menu
    v-if="editor.selection?.isVideo()"
    ref="menu"
    :sourceTexture="texture"
    :sourceSize="img"
    :thumbnailSize="fit(img, { width: 200, height: 200 })"
    :renderer="editor.effectRenderer"
    :effects="effects"
    :effect="editor.selection?.effects?.[0]?.assetId"
    :intensity="editor.selection?.effects?.[0]?.intensity ?? 1"
    :loading="isLoadingTexture"
    @change="onChange"
    class="filters-menu"
  />
</template>
