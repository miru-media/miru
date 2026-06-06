import type { InputEvent } from 'shared/types'
import { clamp, remap, useI18n } from 'shared/utils'
import { formatTime } from 'shared/video/utils.ts'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

const MIN_PPS = 0.005
const MIN_MAX_PPS = 0.2
const PPS_CHANGE_RATIO = 0.75

export const DesktopControls = () => {
  const editor = useEditor()
  const { doc, sync } = editor
  const { tr } = useI18n()
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
              label={tr('undo')}
              disabled={() => !sync.canUndo}
              onClick={sync.undo.bind(sync)}
            >
              <IconMsUndoRounded />
            </button>

            <button
              class={styles.desktopControlsButton}
              label={tr('redo')}
              disabled={() => !sync.canRedo}
              onClick={sync.redo.bind(sync)}
            >
              <IconMsRedoRounded />
            </button>
          </>
        )}

        {() =>
          !editor.isMobileWorkspace && (
            <>
              <button
                label={tr('split')}
                class={styles.desktopControlsButton}
                onClick={() => editor.splitClipAtCurrentTime()}
              >
                <IconMsSplitSceneOutline />
              </button>

              {() =>
                editor.selection && (
                  <>
                    <button
                      label={tr('delete')}
                      class={styles.desktopControlsButton}
                      onClick={() => editor.deleteSelection()}
                    >
                      <IconMsDeleteOutlineRounded />
                    </button>
                  </>
                )
              }
            </>
          )
        }
      </div>

      <div>
        <span class={styles.numeric}>{() => formatTime(editor.doc.currentTime)}</span>
        <span class={[styles.textSecondary, styles.numeric]}>
          &nbsp;/ {() => formatTime(editor.doc.duration)}
        </span>
      </div>

      <div>
        <button
          label={tr('zoom_out')}
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
          title={tr('timeline_zoom')}
          aria-label={tr('timeline_zoom')}
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
          label={tr('zoom_in')}
          class={styles.desktopControlsButton}
          onClick={changePps.bind(null, false)}
        >
          <IconMsAddCircleOutlineRounded />
        </button>
      </div>
    </div>
  )
}
