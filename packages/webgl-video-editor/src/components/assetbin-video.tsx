import { useEditor } from "./utils"
import { MediaAsset } from "../assets/media-asset"
import { computed, effect, ref } from "fine-jsx"
import { useI18n } from "shared/utils"
import styles from "../css/index.module.css"
import { Button } from "shared/components/button"
import { ACCEPT_VIDEO_FILE_TYPES } from "#constants"
import type { InputEvent } from "shared/types"
import { AssetBinVideoPreview } from "./assetbin-video-preview"

export const AssetBinVideo = () => {
    const editor = useEditor()
    const { t } = useI18n()
    const getVideoAssets = (): MediaAsset[] => {
        return Array.from(editor.doc.assets.values()).filter(
            (asset): asset is MediaAsset => asset.type === "asset:media:av" && asset.video != null
        )
    }

    const assets = ref<MediaAsset[]>(getVideoAssets())
    const assetSearchQuery = ref('')
    const activeVideo = ref<MediaAsset | undefined>()

    const assetsFiltered = computed(() => {
        const query = assetSearchQuery.value.trim().toLowerCase()
        if ( query === '') return assets.value
        return assets.value.filter((asset) => (asset.name ?? '').toLowerCase().includes(query))
    })

    effect((onCleanup) => {
        const assetsUpdate = () => (assets.value = getVideoAssets())
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

    return (
        <div class={styles.assetbin}>
            <div class={styles.assetbinHeader}>
                <Button
                onClick={closeAssetbin}
                label={t('assetbin_media_close')}
                class={styles.textGreat}
                >
                    <div class="bulma-icon i-tabler:x"/>
                </Button>
                <h2 class={styles.textGreat}>{t('media')}</h2>
            </div>
            <div class={styles.assetbinInputContainer}>
                <label class={[styles.assetbinUpload, styles.textBodyBold]}>
                    <input 
                        type="file"
                        accept={ACCEPT_VIDEO_FILE_TYPES}
                        aria-label={t('assetbin_media_upload')}
                        hidden
                        onInput={(event: InputEvent) => void onInputVideoFile(event)}
                    />
                    <div class="bulma-icon i-tabler:upload"/>
                    <span>{t('assetbin_media_upload')}</span>
                </label>
                <input
                    type="search"
                    value={() => assetSearchQuery.value}
                    onInput={onSearchInput}
                    class={styles.assetbinSearch}
                    placeholder={t('assetbin_media_search_placeholder')}
                    aria-label={t('assetbin_media_search_placeholder')}
                />
            </div>
            <div class={styles.assetbinAssetsContainer}>
                {() => {
                    if (assets.value.length === 0) {
                        return <p class={styles.textBodySmall}>{t('assetbin_media_empty')}</p>
                    } else if (assetsFiltered.value.length === 0){
                        return <p class={styles.textBodySmall}>{t('assetbin_media_search_empty')}</p>
                    }
                    return assetsFiltered.value.map((asset) => (
                        <button
                            type="button" 
                            class={styles.assetbinAsset}
                            onClick={() => {
                                activeVideo.value = asset
                            }}
                        >
                            <img src={asset.thumbnailUri} />
                            <span class={styles.textBodySmall}>{asset.name}</span>
                        </button>
                    ))
                }}
            </div>
            <AssetBinVideoPreview activeVideo={activeVideo}/>
        </div>
    )
}