import { onScopeDispose, ref, watch } from 'fine-jsx'
import { type WebglEffectsMenuElement } from 'webgl-media-editor'
import 'webgl-media-editor'

import sampleImage from 'shared/assets/320px-Bianchi.jpg'
import { fit, useEventListener } from 'shared/utils'

import { type VideoEditor } from '../VideoEditor'

export const VideoFilterMenu = ({ editor }: { editor: VideoEditor }) => {
  const { movie } = editor
  const { renderer } = movie

  const onChange = (event: CustomEvent<{ effect: string | undefined; intensity: number }>) => {
    const clip = editor.selected
    if (!clip) return

    const { effect, intensity } = event.detail
    editor.setFilter(clip, effect == undefined ? undefined : editor.effects.value.get(effect), intensity)

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

  watch([() => editor.selected], () =>
    menu.value?.scrollToEffect(editor.selected?.filter.value?.id, 'instant'),
  )

  return (
    <webgl-effects-menu
      ref={menu}
      sourceTexture={() => texture}
      sourceSize={img}
      thumbnailSize={() => fit(img, { width: 200, height: 200 })}
      renderer={renderer}
      effects={editor.effects}
      effect={() => editor.selected?.filter.value?.id}
      intensity={() => editor.selected?.filterIntensity.value ?? 1}
      loading={isLoadingTexture}
      onChange={onChange}
      class="filters-menu"
    />
  )
}
