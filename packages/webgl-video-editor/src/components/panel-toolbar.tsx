import type { AssetBin } from '#constants'
import { useI18n } from 'shared/utils'

import styles from '../css/index.module.css'
import { getPanelList } from '../panels-list.ts'

import { useEditor } from './utils.ts'

export const PanelToolbar = ({ onClickHelp }: { onClickHelp?: () => unknown }) => {
  const editor = useEditor()
  const togglePanel = (target: AssetBin) =>
    (editor.activeAssetBin = editor.activeAssetBin === target ? null : target)
  const { t } = useI18n()

  return (
    <menu class={styles.panelToolbar}>
      {getPanelList(editor).map(({ id, titleI18nKey, Icon, isPermitted }) => (
        <li>
          <button
            hidden={() => !isPermitted.value}
            class={styles.panelToggle}
            aria-expanded={() => editor.activeAssetBin === id}
            onClick={togglePanel.bind(null, id)}
          >
            <Icon class={styles.panelToggleIcon} />

            {t(titleI18nKey)}
          </button>
        </li>
      ))}

      {import.meta.env.DEV && (
        <li>
          <button
            class={styles.panelToggle}
            aria-expanded={() => editor._showStats}
            onClick={() => (editor._showStats = !editor._showStats)}
          >
            <IconMsFrameBugRounded class={styles.panelToggleIcon} />
            Debug
          </button>
        </li>
      )}

      {onClickHelp && (
        <li>
          <button class={styles.panelToggle} onClick={onClickHelp} style="margin-top:auto">
            <IconMsHelpOutlineRounded />
            {t('help')}
          </button>
        </li>
      )}
    </menu>
  )
}
