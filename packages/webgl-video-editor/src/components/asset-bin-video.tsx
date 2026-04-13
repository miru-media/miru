import { computed, effect, ref } from 'fine-jsx'

import { ACCEPT_VIDEO_FILE_TYPES } from '#constants'
import { Button } from 'shared/components/button'
import type { InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils'

import type { MediaAsset } from '../assets/media-asset.ts'
import styles from '../css/index.module.css'

import { AssetBinVideoPreview } from './asset-bin-video-preview'
import { useEditor } from './utils.ts'

export const AssetBinVideo = () => {
  const editor = useEditor()
  const { t } = useI18n()
  const getVideoAssets = (): MediaAsset[] =>
    Array.from(editor.doc.assets.values()).filter(
      (asset): asset is MediaAsset => asset.type === 'asset:media:av' && asset.video != null,
    )

  const assets = ref<MediaAsset[]>(getVideoAssets())
  const assetSearchQuery = ref('')
  const activeVideo = ref<MediaAsset | undefined>()

  const assetsFiltered = computed(() => {
    const query = assetSearchQuery.value.trim().toLowerCase()
    if (query === '') return assets.value
    return assets.value.filter((asset) => (asset.name ?? '').toLowerCase().includes(query))
  })

  effect((onCleanup) => {
    const assetsUpdate = () => {
      assets.value = getVideoAssets()
    }
    const assetCreateListener = editor.doc.assets.on('asset:create', assetsUpdate)
    const assetDeleteListener = editor.doc.assets.on('asset:delete', assetsUpdate)

    onCleanup(() => {
      assetCreateListener()
      assetDeleteListener()
    })
  })

  const closeAssetbin = () => {
    editor.activeAssetBin = null
  }

  const onInputVideoFile = async (event: InputEvent) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return

    try {
      await editor.createMediaAsset(file)
    } catch {
      // eslint-disable-next-line no-alert -- TODO
      alert(t('error_cannot_play_type'))
    }
  }

  const onSearchInput = (event: InputEvent) => {
    assetSearchQuery.value = (event.target as HTMLInputElement).value
  }

  return (
    <div class={styles.assetBin}>
      <div class={styles.assetBinHeader}>
        <Button onClick={closeAssetbin} label={t('asset_bin_media_close')} class={styles.textGreat}>
          <div class="bulma-icon i-tabler:x" />
        </Button>
        <h2 class={styles.textGreat}>{t('media')}</h2>
      </div>
      <div class={styles.assetBinInputContainer}>
        <label class={[styles.assetBinUpload, styles.textBodyBold]}>
          <input
            type="file"
            accept={ACCEPT_VIDEO_FILE_TYPES}
            aria-label={t('asset_bin_media_upload')}
            hidden
            onInput={(event: InputEvent) => void onInputVideoFile(event)}
          />
          <div class="bulma-icon i-tabler:upload" />
          <span>{t('asset_bin_media_upload')}</span>
        </label>
        <input
          type="search"
          value={() => assetSearchQuery.value}
          onInput={onSearchInput}
          class={styles.assetBinSearch}
          placeholder={t('asset_bin_media_search_placeholder')}
          aria-label={t('asset_bin_media_search_placeholder')}
        />
      </div>
      <div class={styles.assetBinAssetsContainer}>
        {() => {
          if (assets.value.length === 0) {
            return <p class={styles.textBodySmall}>{t('asset_bin_media_empty')}</p>
          } else if (assetsFiltered.value.length === 0) {
            return <p class={styles.textBodySmall}>{t('asset_bin_media_search_empty')}</p>
          }
          return assetsFiltered.value.map((asset) => (
            <button
              type="button"
              class={[styles.assetBinAsset, styles.assetBinSanitize]}
              onClick={() => {
                activeVideo.value = asset
              }}
            >
              <img src={asset.thumbnailUri} alt={asset.name} />
              <span class={styles.textBodySmall}>{asset.name}</span>
            </button>
          ))
        }}
      </div>
      <AssetBinVideoPreview activeVideo={activeVideo} />
    </div>
  )
}
