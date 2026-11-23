import { computed, effect, h, onScopeDispose, ref } from 'fine-jsx'
import { useEffectThumbnails } from 'webgl-media-editor'

import styles from '#index.module.css'
import { Effect } from 'reactive-effects/effect'
import sampleImage from 'shared/assets/320px-bianchi.jpg'
import type { Size } from 'shared/types'
import { fit, useI18n } from 'shared/utils/index.ts'
import { getImageSize } from 'shared/video/utils.ts'

import { EffectListItem } from '../../effects/effect-list.ts'
import { useEditor } from '../utils.ts'

export const Filters = () => {
  const editor = useEditor()
  const { t } = useI18n()

  const EMPTY_SIZE: Size = { width: 1, height: 1 }
  const MAX_THUMBNAIL_SIZE: Size = { width: 200, height: 200 }

  const clips = computed(() => editor.selection.nodes.filter((node) => node.isVideo()))

  const renderer = editor.effectRenderer
  const sourceTexture = renderer.createTexture()
  onScopeDispose(() => renderer.deleteTexture(sourceTexture))
  const sourceSize = ref(EMPTY_SIZE)
  const thumbnailSize = computed(() => fit(sourceSize.value, MAX_THUMBNAIL_SIZE, 'contain'))
  const effects = ref(new Map<string, Effect>())
  effect((onCleanup) => {
    const next = new Map<string, Effect>()
    for (const [id, asset] of editor.effects) next.set(id, new Effect(asset.raw, renderer))
    effects.value = next

    onCleanup(() => next.forEach((e) => e.dispose()))
  })
  const isLoading = ref(true)
  const img = new Image()
  img.onload = () => {
    isLoading.value = false
    renderer.loadImage(sourceTexture, img)
    sourceSize.value = getImageSize(img)
    thumbnails.update()
  }

  const imgSrc = computed(() => {
    if (clips.value.length !== 1) return sampleImage
    const firstClip = clips.value.at(0)
    if (!firstClip || firstClip.isTextClip()) return sampleImage

    return (firstClip.asset?.thumbnailUri ?? '') || sampleImage
  })

  effect((onCleanup) => {
    isLoading.value = true
    img.setAttribute('src', imgSrc.value)
    onCleanup(() => img.removeAttribute('src'))
  })

  const thumbnails = useEffectThumbnails({
    renderer,
    sourceTexture,
    sourceSize,
    thumbnailSize,
    effects,
    loading: isLoading,
  })

  const currentEffect = computed(() => clips.value.at(0)?.effects[0])

  const onChange = (assetId: string | undefined, intensity: number) => {
    clips.value.forEach((clip) => {
      const clipEffects = clip.effects

      let prev = currentEffect.value

      if (prev && assetId !== prev.assetId) {
        clipEffects.delete(prev.index)
        prev = undefined
      }

      if (assetId) {
        if (prev) {
          clipEffects.update(prev.index, 'assetId', assetId)
          clipEffects.update(prev.index, 'intensity', intensity)
        } else clipEffects.insert(0, new EffectListItem({ assetId, intensity }))
      } else if (prev) {
        clipEffects.delete(prev.index)
      }
    })
  }

  return (
    <div class={[styles.panelBody, styles.assetBinFiltersContainer]}>
      <div class={styles.assetBinAssetsContainer}>
        <button
          type="button"
          class={[styles.assetBinAsset, styles.assetBinSanitize]}
          aria-selected={() => !currentEffect.value}
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
              aria-selected={() => currentEffect.value?.assetId === effect.id}
              onClick={() => onChange(effect.id, 1)}
            >
              {h((isLoading.value ? undefined : thumbnails.canvases.value[index + 1]) ?? 'div', {
                class: styles.assetBinThumbnail,
              })}
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
