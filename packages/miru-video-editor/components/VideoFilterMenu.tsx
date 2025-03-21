import { computed, onScopeDispose, ref, watch } from 'fine-jsx'
import { type WebglEffectsMenuElement } from 'webgl-media-editor'
import 'webgl-media-editor'

import sampleImage from 'shared/assets/320px-Bianchi.jpg'
import { fit, useEventListener } from 'shared/utils'

import { type VideoEffectAsset } from '../nodes/Asset'
import { type VideoEditor } from '../VideoEditor'

export const VideoFilterMenu = ({ editor }: { editor: VideoEditor }) => {
  const { _movie: movie } = editor
  const { renderer } = movie

  const onChange = (event: CustomEvent<{ effect: string | undefined; intensity: number }>) => {
    const clip = editor.selection
    if (!clip) return

    const { effect, intensity } = event.detail
    editor.setClipFilter(
      clip,
      effect == undefined ? undefined : movie.nodes.get<VideoEffectAsset>(effect),
      intensity,
    )

    const { start, end } = clip.presentationTime
    const { currentTime } = movie

    if (currentTime < start || currentTime >= end) movie.seekTo(start)
  }

  const texture = renderer.createTexture()
  const isLoadingTexture = ref(true)
  const img = new Image()
  useEventListener(img, 'load', () => {
    isLoadingTexture.value = false
    renderer.loadImage(texture, img)
  })

  img.src = sampleImage
  onScopeDispose(() => (img.src = ''))

  const menu = ref<WebglEffectsMenuElement>()

  watch([() => editor.selection], () =>
    menu.value?.scrollToEffect(editor.selection?.filter.value?.id, 'instant'),
  )

  return (
    <webgl-effects-menu
      ref={menu}
      sourceTexture={() => texture}
      sourceSize={img}
      thumbnailSize={() => fit(img, { width: 200, height: 200 })}
      renderer={renderer}
      effects={computed(() => new Map(movie.effects.value?.map((effect) => [effect.id, effect])))}
      effect={() => editor.selection?.filter.value?.id}
      intensity={() => editor.selection?.filterIntensity.value ?? 1}
      loading={isLoadingTexture}
      onChange={onChange}
      class="filters-menu"
    />
  )
}
