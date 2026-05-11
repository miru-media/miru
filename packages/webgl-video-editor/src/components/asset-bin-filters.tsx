import { Button } from 'shared/components/button'
import { useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const AssetBinFilters = () => {
  const editor = useEditor()
  const { t } = useI18n()

  const closeAssetbin = () => {
    editor.activeAssetBin = null
  }

  return (
    <div class={styles.assetBin}>
      <div class={styles.assetBinHeader}>
        <Button onClick={closeAssetbin} label={t('asset_bin_filters_close')} class={styles.textGreat}>
          <div class="bulma-icon i-tabler:x" />
        </Button>
        <h2 class={styles.textGreat}>{t('filters')}</h2>
      </div>

    </div>
  )
}