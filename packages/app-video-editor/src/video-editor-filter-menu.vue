<script setup lang="ts">
import { markRaw, onScopeDispose, ref, watch } from 'vue'
import type { Reactive } from 'vue'
import { type WebglEffectsMenuElement } from 'webgl-media-editor'
import 'webgl-media-editor'

import sampleImage from 'shared/assets/320px-bianchi.jpg'
import { fit, useEventListener } from 'shared/utils'

import type { VideoEditor } from 'webgl-video-editor'
import { Effect } from 'reactive-effects/effect'

const { editor } = defineProps<{ editor: Reactive<VideoEditor> }>()
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
  if (!clip?.isVisual()) return

  const { effect, intensity } = event.detail
  const newFilter = effect ? { assetId: effect, intensity } : undefined

  clip.filter = newFilter

  const start = clip.start
  const end = clip.start + clip.duration
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
    editor.selection?.isVisual() && menu.value?.scrollToEffect(editor.selection.filter?.assetId, 'instant'),
)
</script>

<template>
  <webgl-effects-menu
    v-if="editor.selection?.isVisual()"
    ref="menu"
    :sourceTexture="texture"
    :sourceSize="img"
    :thumbnailSize="fit(img, { width: 200, height: 200 })"
    :renderer="editor.effectRenderer"
    :effects="effects"
    :effect="editor.selection?.filter?.assetId"
    :intensity="editor.selection?.filter?.intensity ?? 1"
    :loading="isLoadingTexture"
    @change="onChange"
    class="filters-menu"
  />
</template>
