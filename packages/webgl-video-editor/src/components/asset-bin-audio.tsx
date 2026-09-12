import { computed, effect, ref } from 'fine-jsx'

import { ACCEPT_AUDIO_FILE_TYPES } from '#constants'
import { useI18n } from 'shared/utils'

import type { MediaAsset } from '../assets/media-asset.ts'
import styles from '../css/index.module.css'

import { AssetBinAudioPreview } from './asset-bin-audio-preview'
import { useEditor, useImportMediaFiles } from './utils.ts'

export const AssetBinAudio = () => {
  const editor = useEditor()
  const importMediaFiles = useImportMediaFiles()
  const { t } = useI18n()
  const getAudioAssets = (): MediaAsset[] =>
    Array.from(editor.doc.assets.values()).filter(
      (asset): asset is MediaAsset => asset.type === 'asset:media:av' && !asset.video,
    )

  const assets = ref<MediaAsset[]>(getAudioAssets())
  const assetSearchQuery = ref('')
  const fileInput = ref<HTMLInputElement>()

  const buttonLabel = importMediaFiles ? 'asset_bin_music_import' : 'asset_bin_music_upload'

  const assetsFiltered = computed(() => {
    const query = assetSearchQuery.value.trim().toLowerCase()
    if (query === '') return assets.value
    return assets.value.filter((asset) => (asset.name ?? '').toLowerCase().includes(query))
  })

  effect((onCleanup) => {
    const assetsUpdate = () => {
      assets.value = getAudioAssets()
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

  const onInputAudioFile = async (event: InputEvent) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    await addFiles([file])
    ;(event.target as HTMLInputElement).value = ''
  }

  const onUploadClick = async () => {
    if (importMediaFiles) {
      const files = await importMediaFiles('audio')
      if (files.length === 0) return
      await addFiles(files)
      return
    }
    fileInput.value?.click()
  }

  const onSearchInput = (event: InputEvent) => {
    assetSearchQuery.value = (event.target as HTMLInputElement).value
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
        accept={ACCEPT_AUDIO_FILE_TYPES}
        class={styles.srOnly}
        tabIndex={-1}
        aria-hidden="true"
        onInput={(e: InputEvent) => onInputAudioFile(e)}
      />
      <input
        type="search"
        value={assetSearchQuery}
        onInput={onSearchInput}
        class={styles.panelInput}
        placeholder={t('asset_bin_music_search_placeholder')}
        aria-label={t('asset_bin_music_search_placeholder')}
      />
      <div class={styles.assetBinAudioPreviewContainer}>
        {() => {
          if (assets.value.length === 0) {
            return <p class={styles.textBodySmall}>{t('asset_bin_music_empty')}</p>
          } else if (assetsFiltered.value.length === 0) {
            return <p class={styles.textBodySmall}>{t('asset_bin_music_search_empty')}</p>
          }
          return assetsFiltered.value.map((asset) => <AssetBinAudioPreview asset={asset} />)
        }}
      </div>
    </div>
  )
}
