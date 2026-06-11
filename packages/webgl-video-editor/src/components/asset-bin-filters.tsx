import { computed, effect, h, onScopeDispose, ref } from 'fine-jsx'
import { throttle } from 'throttle-debounce'
import { useEffectThumbnails } from 'webgl-media-editor'

import { Effect } from 'reactive-effects/effect'
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

  const clip = computed(() => {
    const { selection } = editor
    return selection?.isNode && selection.isVideo() ? selection : undefined
  })

  const renderer = editor.effectRenderer
  const sourceTexture = renderer.createTexture()
  onScopeDispose(() => renderer.deleteTexture(sourceTexture))
  const sourceSize = computed(() => editor.playback.renderView._getNode(clip.value)?.getSize() ?? EMPTY_SIZE)
  const thumbnailSize = computed(() => fit(sourceSize.value, MAX_THUMBNAIL_SIZE, 'contain'))
  const effects = ref(new Map<string, Effect>())
  effect((onCleanup) => {
    const next = new Map<string, Effect>()
    for (const [id, asset] of editor.effects) next.set(id, new Effect(asset.raw, renderer))
    effects.value = next

    onCleanup(() => next.forEach((e) => e.dispose()))
  })

  const currentEffect = computed(() => clip.value?.effects.at(0))

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
    renderer.loadImage(sourceTexture, video)
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

  const canvases = useEffectThumbnails({
    renderer,
    sourceTexture,
    sourceSize,
    thumbnailSize,
    effects,
    loading: isLoading,
  })

  return (
    <div class={[styles.panelBody, styles.assetBinFiltersContainer]}>
      <div class={styles.assetBinAssetsContainer}>
        <button
          type="button"
          class={[styles.assetBinAsset, styles.assetBinSanitize]}
          aria-selected={() => !clip.value?.effects[0]}
          onClick={() => onChange(undefined, 1)}
        >
          <div class={styles.assetBinThumbnail}>
            <IconMsBlockOutline style="font-size:1.5rem" />
          </div>
          <span class={styles.textBodySmall}>{t('none')}</span>
        </button>

        {() =>
          [...effects.value.values()].map((effect, index) => (
            <button
              type="button"
              class={[styles.assetBinAsset, styles.assetBinSanitize]}
              aria-selected={() => clip.value?.effects[0]?.assetId === effect.id}
              onClick={() => onChange(effect.id, 1)}
            >
              {h(canvases.value[index + 1] ?? 'div', { class: styles.assetBinThumbnail })}
              <span class={styles.assetBinName}>{effect.name}</span>
            </button>
          ))
        }
      </div>

      {() => (
        <input
          type="range"
          step="any"
          min="0"
          max="1"
          value={() => currentEffect.value?.intensity ?? 1}
          style={() => `visibility: ${currentEffect.value ? 'visible' : 'hidden'}`}
          class={styles.assetBinFilterIntensitySlider}
          onInput={(event: InputEvent) =>
            onChange(currentEffect.value?.assetId, (event.target as HTMLInputElement).valueAsNumber)
          }
        />
      )}
    </div>
  )
}
