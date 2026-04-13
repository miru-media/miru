import { computed, effect, ref } from "fine-jsx"
import { MediaAsset } from "../assets/media-asset"
import styles from "../css/index.module.css"
import { useEditor } from "./utils"
import { Button } from "shared/components/button"
import { useI18n } from "shared/utils"
import { ACCEPT_AUDIO_FILE_TYPES } from "#constants"
import { AssetBinAudioPreview } from "./asset-bin-audio-preview"

export const AssetBinAudio = () => {
    const editor = useEditor()
    const { t }  = useI18n()
    const getAudioAssets = (): MediaAsset[] => {
        return Array.from(editor.doc.assets.values()).filter(
            (asset): asset is MediaAsset => asset.type === 'asset:media:av' && !asset.video
        )
    }

    const assets = ref<MediaAsset[]>(getAudioAssets())
    const assetSearchQuery = ref('')

    const assetsFiltered = computed(() => {
        const query = assetSearchQuery.value.trim().toLowerCase()
        if ( query === '') return assets.value
        return assets.value.filter((asset) => (asset.name ?? '').toLowerCase().includes(query))
    })
   
    effect((onCleanup) => {
        const assetsUpdate = () => (assets.value = getAudioAssets())
        const assetCreateListener = editor.doc.assets.on('asset:create', assetsUpdate)
        const assetDeleteListener = editor.doc.assets.on('asset:delete', assetsUpdate)

        onCleanup(() => {
            assetCreateListener()
            assetDeleteListener()
        })
    })
    
    const onInputAudioFile = async (event: InputEvent) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (!file) return

        try{
            await editor.createMediaAsset(file)
        } catch {
            // eslint-disable-next-line no-alert -- TODO
            alert(t('error_cannot_play_type'))
        }
    }

    const onSearchInput = (event: InputEvent) => {
        assetSearchQuery.value = (event.target as HTMLInputElement).value
    }

    const closeAssetbin = () => {
        editor.activeAssetBin = null
    }

    return (
        <div class={styles.assetBin}>
            <div class={styles.assetBinHeader}>
                <Button
                onClick={closeAssetbin}
                label={t('asset_bin_music_close')}
                class={styles.textGreat}
                >
                    <div class="bulma-icon i-tabler:x"/>
                </Button>
                <h2 class={styles.textGreat}>{t('music')}</h2>
            </div>
           <div class={styles.assetBinInputContainer}>
                <label class={[styles.assetBinUpload, styles.textBodyBold]}>
                    <input 
                        type="file"
                        accept={ACCEPT_AUDIO_FILE_TYPES}
                        aria-label={t('asset_bin_music_upload')}
                        hidden
                        onInput={(event: InputEvent) => void onInputAudioFile(event)}
                    />
                    <div class="bulma-icon i-tabler:upload"/>
                    <span>{t('asset_bin_music_upload')}</span>
                </label>
                <input
                    type="search"
                    value={() => assetSearchQuery.value}
                    onInput={onSearchInput}
                    class={styles.assetBinSearch}
                    placeholder={t('asset_bin_music_search_placeholder')}
                    aria-label={t('asset_bin_music_search_placeholder')}
                />
            </div>
            <div class={styles.assetBinAudioPreviewContainer}>
                {() => {
                    if (assets.value.length === 0) {
                        return <p class={styles.textBodySmall}>{t('asset_bin_music_empty')}</p>
                    } else if (assetsFiltered.value.length === 0){
                        return <p class={styles.textBodySmall}>{t('asset_bin_music_search_empty')}</p>
                    }
                    return assetsFiltered.value.map((asset) => (
                            <AssetBinAudioPreview asset={asset} />
                    ))
                }}
            </div>
        </div>
    )
}