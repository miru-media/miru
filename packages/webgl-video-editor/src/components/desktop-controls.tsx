import type { InputEvent } from 'shared/types'
import { SUPPORTS_FULLSCREEN } from 'shared/userAgent.ts'
import { useI18n } from 'shared/utils'
import { formatTime } from 'shared/video/utils.ts'

import styles from '../css/index.module.css'
import { EDITOR_SELECTION_ACTIONS } from '../editor-actions.ts'

import { useEditor } from './utils.ts'

export const DesktopControls = () => {
  const editor = useEditor()
  const { sync } = editor
  const { t } = useI18n()

  return (
    <div class={styles.desktopControls}>
      <div>
        {sync && (
          <>
            <button
              class={styles.desktopControlsButton}
              aria-label={t('undo')}
              title={t('undo')}
              disabled={() => !sync.canUndo}
              onClick={sync.undo.bind(sync)}
            >
              <IconMsUndoRounded />
            </button>

            <button
              class={styles.desktopControlsButton}
              aria-label={t('redo')}
              title={t('redo')}
              disabled={() => !sync.canRedo}
              onClick={sync.redo.bind(sync)}
            >
              <IconMsRedoRounded />
            </button>
          </>
        )}

        {EDITOR_SELECTION_ACTIONS.map((action) => (
          <button
            aria-label={t(action.localeKey)}
            title={t(action.localeKey)}
            disabled={() => !editor.selection || !action.canPerform(editor)}
            class={styles.desktopControlsButton}
            onClick={() => action.exec(editor)}
          >
            <action.Icon />
          </button>
        ))}
      </div>

      <div>
        <span class={styles.numeric}>{() => formatTime(editor.doc.currentTime)}</span>
        <span class={[styles.textSecondary, styles.numeric]}>
          &nbsp;/ {() => formatTime(editor.doc.duration)}
        </span>
      </div>

      <div>
        <button
          label={t('zoom_out')}
          class={styles.desktopControlsButton}
          onClick={() => editor.timelineZoom.dec()}
        >
          <IconMsDoNotDisturbOnOutlineRounded />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="any"
          title={t('timeline_zoom')}
          aria-label={t('timeline_zoom')}
          value={() => editor.timelineZoom.zeroToOne}
          onInput={(event: InputEvent) => (editor.timelineZoom.zeroToOne = event.target.valueAsNumber)}
        />
        <button
          label={t('zoom_in')}
          class={styles.desktopControlsButton}
          onClick={() => editor.timelineZoom.inc()}
        >
          <IconMsAddCircleOutlineRounded />
        </button>
        {SUPPORTS_FULLSCREEN ? (
          <button
            label={t('fullscreen')}
            class={styles.desktopControlsButton}
            onClick={() => editor._fullscreen.toggle()}
          >
            {() =>
              editor._fullscreen.isFullscreen.value ? (
                <IconMsFullscreenExitRounded />
              ) : (
                <IconMsFullscreenRounded />
              )
            }
          </button>
        ) : (
          <div></div>
        )}
      </div>
    </div>
  )
}
