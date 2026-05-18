import { computed, effect, onScopeDispose, ref } from 'fine-jsx'
import { throttle } from 'throttle-debounce'
import { _mediaEditorContainerClass_, WebglEffectsMenu } from 'webgl-media-editor'

import { Effect } from 'reactive-effects/effect'
import { Button } from 'shared/components/button'
import type { Size } from 'shared/types'
import { fit, useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const AssetBinFilters = () => {
  const editor = useEditor()
  const { t } = useI18n()

  const EMPTY_SIZE: Size = { width: 1, height: 1 }
  const MAX_THUMBNAIL_SIZE: Size = { width: 200, height: 200 }
  const THUMBNAIL_REFRESH_MS = 250

  const closeAssetbin = () => {
    editor.activeAssetBin = null
  }

  const clip = computed(() => {
    const { selection } = editor
    return selection?.isVideo() ? selection : undefined
  })

  const renderer = editor.effectRenderer
  const texture = renderer.createTexture()
  onScopeDispose(() => renderer.deleteTexture(texture))
  const sourceSize = computed(() => (editor.selection?.isVideo() ? editor.selection.mediaSize : EMPTY_SIZE))
  const thumbnailSize = computed(() => fit(sourceSize.value, MAX_THUMBNAIL_SIZE, 'contain'))
  const effects = ref(new Map<string, Effect>())
  effect((onCleanup) => {
    const next = new Map<string, Effect>()
    for (const [id, asset] of editor.effects) next.set(id, new Effect(asset.raw, renderer))
    effects.value = next

    onCleanup(() => next.forEach((e) => e.dispose()))
  })

  const currentEffect = computed(() => editor.selection?.effects.at(0))

  const onChange = (effectId: string | undefined, intensity: number) => {
    if (!clip.value) return

    if (effectId) {
      const prev = clip.value.effects.at(0)
      clip.value.effects = [{ id: prev?.id ?? editor.generateId(), assetId: effectId, intensity }]
    } else {
      clip.value.effects = []
    }
  }

  const isLoading = ref(true)

  const videoElement = computed(() => {
    if (!clip.value) return undefined
    const playbackClip = editor.playback._getNode(clip.value)
    const video = playbackClip?.mediaElement
    return video instanceof HTMLVideoElement ? video : undefined
  })

  const refreshThumbnails = throttle(THUMBNAIL_REFRESH_MS, () => {
    if (!clip.value) return
    const video = videoElement.value
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
    renderer.loadImage(texture, video)
    isLoading.value = false
  })

  effect((onCleanup) => {
    isLoading.value = true
    const offPlaybackUpdate = editor.doc.on('playback:update', refreshThumbnails)

    const video = videoElement.value
    if (video) {
      refreshThumbnails()
      video.addEventListener('loadeddata', refreshThumbnails)
      video.addEventListener('seeked', refreshThumbnails)

      onCleanup(() => {
        video.removeEventListener('loadeddata', refreshThumbnails)
        video.removeEventListener('seeked', refreshThumbnails)
      })
    }

    onCleanup(() => {
      offPlaybackUpdate()
      refreshThumbnails.cancel()
    })
  })

  return (
    <div class={styles.assetBin}>
      <div class={styles.assetBinHeader}>
        <Button onClick={closeAssetbin} label={t('asset_bin_filters_close')} class={styles.textGreat}>
          <div class="bulma-icon i-tabler:x" />
        </Button>
        <h2 class={styles.textGreat}>{t('filters')}</h2>
      </div>
      <div class={[_mediaEditorContainerClass_, styles.assetBinFiltersContainer]}>
        <WebglEffectsMenu
          renderer={renderer}
          sourceTexture={texture}
          sourceSize={sourceSize}
          thumbnailSize={thumbnailSize}
          effects={effects}
          effect={() => currentEffect.value?.assetId}
          intensity={() => currentEffect.value?.intensity ?? 1}
          onChange={onChange}
          loading={isLoading}
        />
      </div>
    </div>
  )
}
