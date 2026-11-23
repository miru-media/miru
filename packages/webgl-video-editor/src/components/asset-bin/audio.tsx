import { ref } from 'fine-jsx'

import type { MediaAsset } from '#assets'
import { ACCEPT_AUDIO_FILE_TYPES } from '#constants'
import styles from '#index.module.css'
import type { InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils'

import { importMediaFiles, useEditor } from '../utils.ts'

import { AudioPreview } from './audio-preview.jsx'
import { useAssetList } from './utils.ts'

export const Audio = () => {
  const fileInput = ref<HTMLInputElement>()

  const editor = useEditor()
  const { t } = useI18n()
  const assetList = useAssetList({
    filterAssets: (asset): asset is MediaAsset =>
      asset.type === 'asset:media:av' && !asset.video && !!asset.audio,
    type: 'audio',
    fileInput,
  })

  const buttonLabel = assetList.importFromContext ? 'asset_bin_music_import' : 'asset_bin_music_upload'

  const onInputAudioFile = async (event: InputEvent) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    await importMediaFiles(editor, files, t)
  }

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
        accept={ACCEPT_AUDIO_FILE_TYPES}
        class={styles.srOnly}
        tabIndex={-1}
        aria-hidden="true"
        onInput={onInputAudioFile}
      />
      <input
        type="search"
        class={styles.panelInput}
        placeholder={t('asset_bin_music_search_placeholder')}
        aria-label={t('asset_bin_music_search_placeholder')}
        {...assetList.searchProps}
      />
      <div class={styles.assetBinAudioPreviewContainer}>
        {() => {
          if (assetList.assets.value.length === 0) {
            return <p class={styles.textBodySmall}>{t('asset_bin_music_empty')}</p>
          } else if (assetList.filtered.value.length === 0) {
            return <p class={styles.textBodySmall}>{t('asset_bin_music_search_empty')}</p>
          }
          return assetList.filtered.value.map((asset) => (
            <AudioPreview asset={asset} data-asset-id={asset.id} />
          ))
        }}
      </div>
    </div>
  )
}
