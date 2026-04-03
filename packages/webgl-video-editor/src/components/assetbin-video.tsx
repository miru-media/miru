import { useEditor } from "./utils"
import { MediaAsset } from "../assets/media-asset"
import { effect, ref } from "fine-jsx"
import { useI18n } from "shared/utils"
import styles from "../css/index.module.css"
import { Button } from "shared/components/button"
import { ACCEPT_VIDEO_FILE_TYPES } from "#constants"
import type { InputEvent } from "shared/types"

export const AssetBinVideo = () => {
    const editor = useEditor()
    const { t } = useI18n()
    const getVideoAssets = (): MediaAsset[] => {
        return Array.from(editor.doc.assets.values()).filter(
            (asset): asset is MediaAsset => asset.type === "asset:media:av" && asset.video != null
        )
    }

    const assets = ref<MediaAsset[]>(getVideoAssets())

    effect((onCleanup) => {
        const assetsUpdate = () => (assets.value = getVideoAssets())
        const assetCreateListener = editor.doc.assets.on('asset:create', assetsUpdate)

        onCleanup(() => {
            assetCreateListener()
        })
    })

    const closeAssetbin = () => {
        editor.activeAssetBin = null
    }

    const onInputVideoFile = async (event: InputEvent) => {
        const file = event.target.files?.[0]
        if (!file) return

        try{
            await editor.createMediaAsset(file)
        } catch {
            // eslint-disable-next-line no-alert -- TODO
            alert(t('error_cannot_play_type'))
        }
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
            <div class={styles.assetbinUploadContainer}>
                <label class={[styles.assetbinUpload, styles.textBodyBold]}>
                    <input 
                        type="file"
                        accept={ACCEPT_VIDEO_FILE_TYPES}
                        hidden
                        onInput={(event: InputEvent) => void onInputVideoFile(event)}
                    />
                    <div class="bulma-icon i-tabler:upload"/>
                    <span>{t('assetbin_media_upload')}</span>
                </label>
            </div>
            <div class={styles.assetbinAssetsContainer}>
                {()=>
                    assets.value.length === 0 ? (
                        <p>{t('assetbin_media_empty')}</p>
                    ) : (
                        assets.value.map((asset) => (
                            <div class={styles.assetbinAsset}>
                                <img src={asset.thumbnailUri} />
                                <span class={styles.textBodySmall}>{asset.name}</span>
                            </div>
                        ))
                    )
                }
            </div>
        </div>
    )
}