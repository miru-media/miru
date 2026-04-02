import { useEditor } from "./utils"
import { MediaAsset } from "../assets/media-asset"
import { effect, ref } from "fine-jsx"
import { useI18n } from "shared/utils"
import styles from "../css/index.module.css"
import { Button } from "shared/components/button"

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