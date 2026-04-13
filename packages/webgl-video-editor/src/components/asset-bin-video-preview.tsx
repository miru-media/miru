import { computed, effect, ref, type Ref } from "fine-jsx"
import type { MediaAsset } from "../assets/media-asset"
import styles from "../css/index.module.css"
import { useEditor } from "./utils"
import type { Track } from "#core"
import { useI18n } from "shared/utils"
import { Button } from "shared/components/button"


export const AssetBinVideoPreview = (props: { activeVideo: Ref<MediaAsset | undefined>}) => {
    const { activeVideo } = props
    const dialogRef = ref<HTMLDialogElement>()
    const editor = useEditor()
    const { t } = useI18n()
    const isDeleting = ref(false)

    const videoSrc = computed(() => {
        if (!activeVideo.value) return ''
        return activeVideo.value.blobUrl || activeVideo.value.uri || ''
    })

    effect(() => {
        if (!dialogRef.value) return
        if (activeVideo.value && !dialogRef.value.open) {
            dialogRef.value?.showModal()
        }else if (!activeVideo && dialogRef.value.open) {
            dialogRef.value.close()
        }
    })

    const closeDialogue = () => {
        activeVideo.value = undefined
    }

    const createClip = () => {
        if (!activeVideo.value || !dialogRef.value) return
        try {
            const track: Track = editor.tracks.find((track) => track.trackType === 'video') ?? editor.addTrack('video')
            const clip = editor.addClip(track, activeVideo.value)
            editor.select(clip)
            dialogRef.value.close()
            editor.activeAssetBin = null
        } catch {
            alert(t('error_cannot_create_clip'))
        }
    }

    const isVideoInUse = computed(() => {
        if (!activeVideo.value) return true
        let activeClip = false
        editor.doc.nodes.forEach((node) => {
            if (!node.isClip()) return
            if (node.mediaRef.assetId === activeVideo.value?.id) activeClip = true
        })
        return activeClip
    })

    const deleteLabel = computed(() => isVideoInUse.value ? t('asset_bin_delete_video_disabled') : t('asset_bin_delete_video'))

    const deleteVideo = async () => {
        if(!activeVideo.value || isVideoInUse.value || isDeleting.value || !dialogRef.value) return

        isDeleting.value = true
        try {
            await editor.doc.assets.delete(activeVideo.value.id)
            dialogRef.value.close()
        } catch {
            alert(t('error_cannot_delete_video'))
        } finally {
            isDeleting.value = false
        }
    }
    
    return(
        <dialog
            class={styles.assetBinDialogue}
            ref={dialogRef}
            closedby="any"
            onClose={closeDialogue}
        >
            <video
                src={videoSrc}
                aria-label={() => activeVideo.value?.name}
                controls
                autoplay
            />
            <span>{() => activeVideo.value?.name || ''}</span>
            <div class={styles.dialogueButtonContainer}>
                <Button
                    disabled={() => isDeleting.value || isVideoInUse.value}
                    onClick={deleteVideo}
                    class={[styles.assetBinDelete, styles.textBodyBold]}
                    label={deleteLabel}
                >
                    <div class={[styles.assetBinButton]}>
                        <span>{t('asset_bin_delete_video')}</span>
                        <div class="bulma-icon i-tabler:trash"/>
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
                        <div class="bulma-icon i-tabler:circle-plus" />
                    </div>
                </Button>
            </div>
        </dialog>
    )
}