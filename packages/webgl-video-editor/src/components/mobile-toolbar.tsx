import { AssetBin } from '#constants'
import { useI18n } from 'shared/utils'

import styles from '../css/index.module.css'
import { EDITOR_SELECTION_ACTIONS } from '../editor-actions.ts'
import { getPanelList } from '../panels-list.ts'

import { useEditor } from './utils.ts'

export const MobileToolbar = ({ onClickHelp }: { onClickHelp?: () => unknown }) => {
  const editor = useEditor()
  const { t } = useI18n()

  return (
    <div class={styles.mobileToolbar}>
      {() =>
        editor.selection ? (
          <>
            <button class={styles.mobileToolbarBackButton} onClick={editor.select.bind(editor, undefined)}>
              <IconMsArrowBackRounded />
            </button>

            {EDITOR_SELECTION_ACTIONS.map((action) => (
              <button
                aria-label={t(action.localeKey)}
                title={t(action.localeKey)}
                class={styles.mobileToolbarButton}
                disabled={() => !action.canPerform(editor)}
                onClick={() => action.exec(editor)}
              >
                <action.Icon />
                {t(action.localeKey)}
              </button>
            ))}

            {() =>
              editor.selection?.isNode &&
              editor.selection.isVideo() &&
              editor.selection.isMediaClip() && (
                <button
                  class={styles.mobileToolbarButton}
                  aria-expanded={editor.activeAssetBin === AssetBin.filters}
                  commandfor={editor.getPartId(AssetBin.filters)}
                  command="show-modal"
                >
                  <IconMsFilterVintageOutline />
                  {t('filters')}
                </button>
              )
            }
            {() =>
              editor.selection?.isNode &&
              editor.selection.isTextClip() && (
                <button
                  class={styles.mobileToolbarButton}
                  aria-expanded={editor.activeAssetBin === AssetBin.fonts}
                  commandfor={editor.getPartId(AssetBin.fonts)}
                  command="show-modal"
                >
                  <IconMsTextFieldsRounded />
                  {t('fonts')}
                </button>
              )
            }
          </>
        ) : (
          <>
            {getPanelList(editor)
              .filter((p) => !p.isForSelection)
              .map(({ id, titleI18nKey, Icon, isPermitted }) => (
                <button
                  hidden={() => !isPermitted.value}
                  class={styles.mobileToolbarButton}
                  aria-expanded={editor.activeAssetBin === id}
                  commandfor={editor.getPartId(id)}
                  command="show-modal"
                >
                  <Icon />
                  {t(titleI18nKey)}
                </button>
              ))}

            {onClickHelp && (
              <button class={styles.mobileToolbarButton} onClick={onClickHelp}>
                <IconMsHelpOutlineRounded />
                {t('help')}
              </button>
            )}
          </>
        )
      }
    </div>
  )
}
