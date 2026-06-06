import { computed, effect, ref, type Ref } from 'fine-jsx'

import { Button } from 'shared/components/button'
import { useAsyncCallback, useI18n } from 'shared/utils'

import type { MediaAsset } from '../assets/media-asset.ts'
import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const AssetBinVideoPreview = (props: { activeVideo: Ref<MediaAsset | undefined> }) => {
  const { activeVideo } = props
  const dialogRef = ref<HTMLDialogElement>()
  const editor = useEditor()
  const { t } = useI18n()

  const videoSrc = computed(() => {
    if (!activeVideo.value) return ''
    return activeVideo.value.blobUrl || (activeVideo.value.uri ?? '')
  })

  effect(() => {
    if (!dialogRef.value) return
    if (activeVideo.value && !dialogRef.value.open) {
      dialogRef.value.showModal()
    } else if (!activeVideo.value && dialogRef.value.open) {
      dialogRef.value.close()
    }
  })

  const closeDialogue = () => {
    activeVideo.value = undefined
  }

  const createClip = () => {
    if (!activeVideo.value || !dialogRef.value) return
    try {
      const asset = activeVideo.value
      const clip = editor.addClip(editor.getTrackForMedia(asset), asset)
      editor.select(clip)
      dialogRef.value.close()
      editor.activeAssetBin = null
    } catch {
      // eslint-disable-next-line no-alert -- TODO
      alert(t('error_cannot_create_clip'))
    }
  }

  const isVideoInUse = computed(() => {
    if (!activeVideo.value) return true
    let activeClip = false
    editor.doc.nodes.forEach((node) => {
      if (!node.isClip()) return
      if (node.mediaRef?.assetId === activeVideo.value?.id) activeClip = true
    })
    return activeClip
  })

  const deleteLabel = computed(() =>
    isVideoInUse.value ? t('asset_bin_delete_video_disabled') : t('asset_bin_delete_video'),
  )

  const [deleteVideo, isDeleting] = useAsyncCallback(async () => {
    if (!activeVideo.value || isVideoInUse.value || !dialogRef.value) return
    try {
      await editor.doc.assets.delete(activeVideo.value.id)
      dialogRef.value.close()
    } catch {
      // eslint-disable-next-line no-alert -- TODO
      alert(t('error_cannot_delete_video'))
    }
  })

  const dialogLabel = computed(() => activeVideo.value?.name ?? '')

  return (
    <dialog
      class={styles.assetBinDialogue}
      ref={dialogRef}
      closedby="any"
      onClose={closeDialogue}
      aria-label={dialogLabel}
    >
      <video src={videoSrc} aria-label={() => activeVideo.value?.name} controls autoplay />
      <span>{() => activeVideo.value?.name ?? ''}</span>
      <div class={styles.dialogueButtonContainer}>
        <Button
          disabled={() => isDeleting.value || isVideoInUse.value}
          onClick={deleteVideo}
          class={[styles.assetBinDelete, styles.textBodyBold]}
          label={deleteLabel}
        >
          <div class={[styles.assetBinButton]}>
            <span>{t('asset_bin_delete_video')}</span>
            <IconMsDeleteOutlineRounded />
          </div>
        </Button>
        <Button
          onClick={createClip}
          disabled={() => isDeleting.value}
          label={t('asset_bin_media_create_clip')}
          class={[styles.assetBinCreateClip, styles.textBodyBold]}
        >
          <div class={styles.assetBinButton}>
            <span>{t('asset_bin_media_create_clip')}</span>
            <IconMsAddCircleOutlineRounded />
          </div>
        </Button>
      </div>
    </dialog>
  )
}
