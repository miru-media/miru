import { computed, effect, ref } from 'fine-jsx'

import type { ImageAsset, MediaAsset } from '#assets'
import { useAsyncCallback, useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const AssetBinVideoPreview = (props: { asset: MediaAsset | ImageAsset; onClose: () => void }) => {
  const { asset, onClose } = props
  const dialogRef = ref<HTMLDialogElement>()
  const editor = useEditor()
  const { t } = useI18n()

  effect((onCleanup) => {
    const dialog = dialogRef.value
    if (!dialog) return
    if (!dialog.open) {
      dialog.showModal()
      onCleanup(dialog.close.bind(dialog))
    }
  })

  const createClip = () => {
    try {
      const clip = editor.addMediaClip(asset)
      editor.select(clip)
      dialogRef.value?.close()
      editor.activeAssetBin = null
    } catch {
      // eslint-disable-next-line no-alert -- TODO
      alert(t('error_cannot_create_clip'))
    }
  }

  const isVideoInUse = computed(() => {
    let activeClip = false
    editor.doc.nodes.forEach((node) => {
      if (!node.isClip()) return
      if (node.mediaRef?.id === asset.id) activeClip = true
    })
    return activeClip
  })

  const deleteLabel = computed(() =>
    isVideoInUse.value ? t('asset_bin_delete_video_disabled') : t('asset_bin_delete_video'),
  )

  const [deleteVideo, isDeleting] = useAsyncCallback(async () => {
    if (isVideoInUse.value || !dialogRef.value) return
    try {
      await editor.doc.assets.delete(asset.id)
      dialogRef.value.close()
    } catch {
      // eslint-disable-next-line no-alert -- TODO
      alert(t('error_cannot_delete_video'))
    }
  })

  const previewElementProps = {
    src: () => asset.blobUrl || (asset.uri ?? ''),
    ariaLabel: () => asset.name ?? '',
    class: styles.assetBinPreviewElement,
  }

  return (
    <dialog
      class={styles.assetBinPreview}
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-label={asset.name ?? ''}
    >
      {asset.type === 'asset:media:av' ? (
        <video {...previewElementProps} controls autoplay playsInline />
      ) : (
        <img {...previewElementProps} />
      )}
      <span>{() => asset.name ?? ''}</span>
      <div class={styles.dialogueButtonContainer}>
        <button onClick={onClose} class={[styles.ctaButton]}>
          {t('close')}
          <IconMsCloseRounded />
        </button>
        <button
          disabled={() => isDeleting.value || isVideoInUse.value}
          onClick={deleteVideo}
          class={[styles.ctaButton, styles.danger, styles.textBodyBold]}
          aria-label={deleteLabel}
        >
          {t('asset_bin_delete_video')}
          <IconMsDeleteOutlineRounded />
        </button>
        <button
          onClick={createClip}
          disabled={() => isDeleting.value}
          aria-label={t('asset_bin_media_create_clip')}
          class={[styles.ctaButton, styles.primary, styles.textBodyBold]}
        >
          {t('asset_bin_media_create_clip')}
          <IconMsAddCircleOutlineRounded />
        </button>
      </div>
    </dialog>
  )
}
