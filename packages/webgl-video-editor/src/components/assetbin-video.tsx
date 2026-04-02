import { useEditor } from "./utils"
import { MediaAsset } from "../assets/media-asset"
import { effect, ref } from "fine-jsx"
import { useI18n } from "shared/utils"

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

    return (
        <div>
            <h2>{t('media')}</h2>
            {()=>
                assets.value.length === 0 ? (
                    <p>{t('assetbin_media_empty')}</p>
                ) : (
                    assets.value.map((asset) => (
                        <div>
                            <h3>{asset.name}</h3>
                            <img src={asset.thumbnailUri}/>
                        </div>
                    ))
                )
            }
        </div>
    )
}