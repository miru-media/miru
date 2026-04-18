import { Button } from 'shared/components/button'
import styles from '../css/index.module.css'
import { useEditor } from './utils'
import { useI18n } from 'shared/utils'


export const AssetBinFonts = () => {
    const editor = useEditor()
    const { t } = useI18n()

    const closeAssetbin = () => {
      editor.activeAssetBin = null
    }

    return (
        <div class={styles.assetBin}>
            <div class={styles.assetBinHeader}>
                <Button onClick={closeAssetbin} label={t('asset_bin_fonts_close')} class={styles.textGreat}>
                <div class="bulma-icon i-tabler:x" />
                </Button>
                <h2 class={styles.textGreat}>{t('fonts')}</h2>
            </div>
            <div class={styles.assetBinInputContainer}>
                <button class={[styles.assetBinUpload, styles.textBodyBold]}>
                    <div class="bulma-icon i-tabler:circle-plus" />
                    <span>{t('asset_bin_fonts_add')}</span>
                </button>
            </div>
        </div>
    )
}