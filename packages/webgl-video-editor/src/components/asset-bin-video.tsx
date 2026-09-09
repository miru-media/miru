import { computed, effect, ref } from 'fine-jsx'

import { ACCEPT_VIDEO_FILE_TYPES } from '#constants'
import type { InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils'

import type { MediaAsset } from '../assets/media-asset.ts'
import styles from '../css/index.module.css'

import { AssetBinVideoPreview } from './asset-bin-video-preview'
import { useEditor, useImportMediaFiles } from './utils.ts'

export const AssetBinVideo = () => {
  const editor = useEditor()
  const importMediaFiles = useImportMediaFiles()
  const { t } = useI18n()
  const getVideoAssets = (): MediaAsset[] =>
    Array.from(editor.doc.assets.values()).filter(
      (asset): asset is MediaAsset =>
        asset.type === 'asset:media:av' && (!!asset.video || asset.mimeType.startsWith('video/')),
    )

  const assets = ref<MediaAsset[]>(getVideoAssets())
  const assetSearchQuery = ref('')
  const activeVideo = ref<MediaAsset | undefined>()
  const fileInput = ref<HTMLInputElement>()

  const buttonLabel = importMediaFiles ? 'asset_bin_media_import' : 'asset_bin_media_upload'

  const assetsFiltered = computed(() => {
    const query = assetSearchQuery.value.trim().toLowerCase()
    if (query === '') return assets.value
    return assets.value.filter((asset) => (asset.name ?? '').toLowerCase().includes(query))
  })

  effect((onCleanup) => {
    const assetsUpdate = () => {
      assets.value = getVideoAssets()
    }
    const assetCreateOff = editor.doc.assets.on('asset:create', assetsUpdate)
    const assetDeleteOff = editor.doc.assets.on('asset:delete', assetsUpdate)

    onCleanup(() => {
      assetCreateOff()
      assetDeleteOff()
    })
  })

  const addFiles = async (files: File[]) => {
    for (const file of files) {
      try {
        // eslint-disable-next-line no-await-in-loop -- TODO
        await editor.createMediaAsset(file)
      } catch {
        // eslint-disable-next-line no-alert -- TODO
        alert(t('error_cannot_play_type'))
      }
    }
  }

  const onInputVideoFile = async (event: InputEvent) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    await addFiles([file])
    input.value = ''
  }

  const onUploadClick = async () => {
    if (importMediaFiles) {
      const files = await importMediaFiles('video')
      if (files.length === 0) return
      await addFiles(files)
      return
    }
    fileInput.value?.click()
  }

  const onSearchInput = (event: InputEvent) => {
    assetSearchQuery.value = event.target.value
  }

  return (
    <div class={styles.panelBody}>
      <button
        type="button"
        class={[styles.wideButton, styles.textBodyBold]}
        aria-label={t(buttonLabel)}
        onClick={() => onUploadClick()}
      >
        <IconMsUploadRounded />
        <span>{t(buttonLabel)}</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_VIDEO_FILE_TYPES}
        class={styles.srOnly}
        tabIndex={-1}
        aria-hidden="true"
        onInput={(e: InputEvent) => onInputVideoFile(e)}
      />
      <input
        type="search"
        value={assetSearchQuery}
        onInput={onSearchInput}
        class={styles.panelInput}
        placeholder={t('asset_bin_media_search_placeholder')}
        aria-label={t('asset_bin_media_search_placeholder')}
      />

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
              <img src={asset.thumbnailUri} alt="" class={styles.assetBinThumbnail} />
              <span class={styles.assetBinName}>{asset.name}</span>
            </button>
          ))
        }}
      </div>
      {() => activeVideo.value && <AssetBinVideoPreview activeVideo={activeVideo} />}
    </div>
  )
}
