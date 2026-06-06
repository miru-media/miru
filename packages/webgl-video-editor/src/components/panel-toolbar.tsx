import type { AssetBin } from '#constants'
import { useI18n } from 'shared/utils'

import styles from '../css/index.module.css'
import { getPanelList } from '../panels-list.ts'

import { useEditor } from './utils.ts'

export const PanelToolbar = () => {
  const editor = useEditor()
  const togglePanel = (target: AssetBin) =>
    (editor.activeAssetBin = editor.activeAssetBin === target ? null : target)
  const { t } = useI18n()

  return (
    <div class={styles.panelToolbar}>
      {getPanelList(editor).map(({ id, titleI18nKey, Icon, isPermitted = () => true }) => (
        <button
          hidden={() => !isPermitted()}
          class={styles.panelToggle}
          aria-expanded={() => editor.activeAssetBin === id}
          onClick={togglePanel.bind(null, id)}
        >
          <Icon class={styles.panelToggleIcon} />

          {t(titleI18nKey)}
        </button>
      ))}

      {import.meta.env.DEV && (
        <button
          class={styles.panelToggle}
          aria-expanded={() => editor._showStats}
          onClick={() => (editor._showStats = !editor._showStats)}
        >
          <IconMsFrameBugRounded class={styles.panelToggleIcon} />
          Debug
        </button>
      )}
    </div>
  )
}
