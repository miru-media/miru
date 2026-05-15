import { Button } from 'shared/components/button'
import { fit, useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'
import { WebglEffectsMenu } from 'webgl-media-editor'
import { computed, effect, ref } from 'fine-jsx'
import type { Size } from 'shared/types'
import { Effect } from 'reactive-effects/effect'

export const AssetBinFilters = () => {
  const editor = useEditor()
  const { t } = useI18n()

  const EMPTY_SIZE: Size = { width: 1, height: 1 }
  const MAX_THUMBNAIL_SIZE: Size = { width: 200, height: 200 }

  const closeAssetbin = () => {
    editor.activeAssetBin = null
  }



  const renderer = editor.effectRenderer
  const texture = renderer.createTexture()
  const sourceSize = computed(() => editor.selection?.isVideo() ? editor.selection.mediaSize : EMPTY_SIZE)
  const thumbnailSize = computed(() => fit(sourceSize.value, MAX_THUMBNAIL_SIZE, 'contain'))
  const effects = ref(new Map<string, Effect>())
  effect((onCleanup) => {
    const next = new Map<string, Effect>()
    for (const [id, asset] of editor.effects) next.set(id, new Effect(asset.raw, renderer))
    effects.value = next

    onCleanup(() => next.forEach((e) => e.dispose))
  })

  const currentEffect = computed(() => editor.selection?.effects.at(0))

  const onChange = (effectId: string | undefined, intensity: number) => {
    if (!editor.selection) return

    if (effectId) {
      const prev = editor.selection.effects.at(0)
      editor.selection.effects = [{ id: prev?.id ?? editor.generateId(), assetId: effectId, intensity }]
    } else {
      editor.selection.effects = []
    }
  }

  return (
    <div class={styles.assetBin}>
      <div class={styles.assetBinHeader}>
        <Button onClick={closeAssetbin} label={t('asset_bin_filters_close')} class={styles.textGreat}>
          <div class="bulma-icon i-tabler:x" />
        </Button>
        <h2 class={styles.textGreat}>{t('filters')}</h2>

        <WebglEffectsMenu
          renderer={renderer}
          sourceTexture={texture}
          sourceSize={sourceSize}
          thumbnailSize={thumbnailSize}
          effects={effects}
          effect={() => currentEffect.value?.assetId}
          intensity={() => currentEffect.value?.intensity ?? 1}
          onChange={onChange}
        />
      </div>

    </div>
  )
}