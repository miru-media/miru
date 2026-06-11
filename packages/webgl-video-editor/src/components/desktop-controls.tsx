import type { InputEvent } from 'shared/types'
import { clamp, remap, useI18n } from 'shared/utils'
import { formatTime } from 'shared/video/utils.ts'

import styles from '../css/index.module.css'
import { EDITOR_SELECTION_ACTIONS } from '../editor-actions.ts'

import { useEditor } from './utils.ts'

const MIN_PPS = 0.005
const MIN_MAX_PPS = 0.2
const PPS_CHANGE_RATIO = 0.75

export const DesktopControls = () => {
  const editor = useEditor()
  const { doc, sync } = editor
  const { t } = useI18n()
  const maxPps = () => Math.max(MIN_MAX_PPS, (doc.duration / editor._timelineSize.value.width) * 2)

  const changePps = (decrease: boolean): void => {
    editor._secondsPerPixel.value = clamp(
      editor._secondsPerPixel.value * (decrease ? 1 / PPS_CHANGE_RATIO : PPS_CHANGE_RATIO),
      MIN_PPS,
      maxPps(),
    )
  }

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
          onClick={changePps.bind(null, true)}
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
          value={() => remap(editor._secondsPerPixel.value, MIN_PPS, maxPps(), 1, 0) ** 2}
          onInput={(event: InputEvent) => {
            editor._secondsPerPixel.value = remap(
              Math.sqrt(event.target.valueAsNumber),
              1,
              0,
              MIN_PPS,
              maxPps(),
            )
          }}
        />

        <button
          label={t('zoom_in')}
          class={styles.desktopControlsButton}
          onClick={changePps.bind(null, false)}
        >
          <IconMsAddCircleOutlineRounded />
        </button>
      </div>
    </div>
  )
}
