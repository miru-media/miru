import { computed, ref } from "fine-jsx"
import type { MediaAsset } from "../assets/media-asset"
import styles from "../css/index.module.css"
import { useEditor } from "./utils"
import { Button } from "shared/components/button"
import type { Track } from "#core"
import { useI18n } from "shared/utils"
import { formatTime } from "shared/video/utils"

export const AssetBinAudioPreview = (props: {
    asset: MediaAsset
}) => {
    const { asset } = props
    const editor = useEditor()
    const { t } = useI18n()
    const audioSrc = asset.blobUrl || asset.uri || ''
    
    const audioRef = ref<HTMLAudioElement>()
    const isPlaying = ref(false)
    const isDeleting = ref(false)

    const togglePlayback = async () => {
        if(!audioRef.value) return
        if (audioRef.value.paused) {
            isPlaying.value = true
            await Promise.resolve()
            audioRef.value.play()
        } else {
            isPlaying.value = false
            audioRef.value.pause()
        }
    }

    const isAudioInUse = computed(() => {
        if (!asset) return true
        let activeClip = false
        editor.doc.nodes.forEach((node) => {
            if (!node.isClip()) return
            if (node.mediaRef.assetId === asset.id) activeClip = true
        })
        return activeClip
    })

   const deleteAudio = async () => {
    if (isAudioInUse.value || isDeleting.value) return
    isDeleting.value = true
    try {
        await editor.doc.assets.delete(asset.id)
    } catch {
        alert(t('error_cannot_delete_music'))
    } finally {
        isDeleting.value = false
    }
   }
    
    const createClip = () => {
        if (isDeleting.value) return
        try {
            const track: Track = editor.tracks.find((track) => track.trackType === 'audio') ?? editor.addTrack('audio')
            const clip = editor.addClip(track, asset)
            editor.select(clip)
            editor.activeAssetBin = null
        } catch {
            alert(t('error_cannot_create_clip'))
        }
    }

    return (
        <div class={styles.assetBinAudioAssetContainer}>
            <div class={styles.assetBinAudioAssetHeader}>
                <div class={styles.assetBinAudioAssetMeta}>
                    <button
                        class={[styles.assetBinAudioThumbnailContainer, styles.assetBinSanitize]}
                        aria-label={() => (isPlaying.value ? t('Pause') : t('Pause'))}
                        onClick={togglePlayback}
                    >
                        <div class={styles.assetBinAudioThumbnail}>
                            { asset.thumbnailUri && (
                                <img
                                    src={asset.thumbnailUri}
                                    alt={asset.name}
                                />
                            )
                            }
                        </div>
                        <div class={styles.assetBinAudioThumbnailOverlay}>
                            { () => (
                                <div class={['bulma-icon', isPlaying.value ? 'i-tabler:player-pause-filled' : 'i-tabler:player-play-filled']} />
                            )}
                        </div>
                    </button>
                    <div class={styles.assetBinAudioText}>
                        <span class={styles.textBody}>{asset.name}</span>
                        <span>{ () => formatTime(asset.duration, false)}</span>
                    </div>
                </div>
                <div class={styles.assetBinAudioButtonContainer}>
                    <Button
                        onClick={deleteAudio}
                        disabled={() => isAudioInUse.value}
                        class={styles.assetBinDelete}
                        label={() => (isAudioInUse.value ? t('asset_bin_delete_music_disabled') : t('asset_bin_delete_music'))}
                    >
                        <div class="bulma-icon i-tabler:trash" />
                    </Button>
                    <Button
                        class={styles.assetBinCreateClip}
                        onClick={createClip}
                        label={t('asset_bin_music_create_clip')}
                    >
                        <div class="bulma-icon i-tabler:circle-plus" />
                    </Button>
                </div>
            </div>
            <audio
                ref={audioRef} 
                src={audioSrc}
                style={() => (isPlaying.value ? '' : 'display:none')}
                class={styles.assetBinAudioPlayer}
                onEnded={() => (isPlaying.value = false)}
                onPause={(e: Event) => {
                    if (!(e.target as HTMLAudioElement).seeking) {
                        isPlaying.value = false
                    }
                }}
                controls
                aria-label={asset.name}
            />
        </div>
    )
}