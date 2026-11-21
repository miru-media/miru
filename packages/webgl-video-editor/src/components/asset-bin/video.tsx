import { ref } from 'fine-jsx'

import type { MediaAsset } from '#assets'
import { ACCEPT_VISUAL_FILE_TYPE } from '#constants'
import styles from '#index.module.css'
import { useI18n } from 'shared/utils'

import { useEditor, useImportMediaFiles } from '../utils.ts'

import { useAssetList } from './utils.ts'
import { VideoPreview } from './video-preview.jsx'

export const Video = () => {
  const editor = useEditor()
  const fileInput = ref<HTMLInputElement>()

  const importMediaFiles = useImportMediaFiles()
  const { t } = useI18n()
  const assetList = useAssetList({
    filterAssets: (asset): asset is MediaAsset =>
      (asset.type === 'asset:media:av' && (!!asset.video || asset.mimeType.startsWith('video/'))) ||
      asset.type === 'asset:media:image',
    type: 'video',
    fileInput,
  })

  const activeVideo = ref<MediaAsset | undefined>()

  const buttonLabel = importMediaFiles ? 'asset_bin_media_import' : 'asset_bin_media_upload'

  return (
    <div class={styles.panelBody}>
      <button
        type="button"
        class={[styles.wideButton, styles.textBodyBold]}
        aria-label={t(buttonLabel)}
        onClick={assetList.onClickUpload}
      >
        <IconMsUploadRounded />
        <span>{t(buttonLabel)}</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT_VISUAL_FILE_TYPE}
        class={styles.srOnly}
        tabIndex={-1}
        aria-hidden="true"
        onInput={assetList.onInputFile}
      />
      <input
        type="search"
        class={styles.panelInput}
        placeholder={t('asset_bin_media_search_placeholder')}
        aria-label={t('asset_bin_media_search_placeholder')}
        {...assetList.searchProps}
      />

      <div class={styles.assetBinAssetsContainer} onDragstart={editor.assetDrag.onDelegatedDragStart}>
        {() => {
          if (assetList.assets.value.length === 0) {
            return <p class={styles.textBodySmall}>{t('asset_bin_media_empty')}</p>
          } else if (assetList.filtered.value.length === 0) {
            return <p class={styles.textBodySmall}>{t('asset_bin_media_search_empty')}</p>
          }
          return assetList.filtered.value.map((asset) => (
            <button
              type="button"
              class={[styles.assetBinAsset, styles.assetBinSanitize]}
              onClick={() => (activeVideo.value = asset)}
              data-asset-id={asset.id}
              draggable
              {...{ [editor.assetDrag.THUMBNAIL_ATTR]: '' }}
            >
              <img src={asset.thumbnailUri} alt="" class={styles.assetBinThumbnail} />
              <span class={styles.assetBinName}>{asset.name}</span>
            </button>
          ))
        }}
      </div>
      {() =>
        activeVideo.value && (
          <VideoPreview asset={activeVideo.value} onClose={() => (activeVideo.value = undefined)} />
        )
      }
    </div>
  )
}
