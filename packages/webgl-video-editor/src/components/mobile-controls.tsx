import { Button } from 'shared/components/button.tsx'
import { useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const MobileControls = () => {
  const editor = useEditor()
  const { playback, sync } = editor
  const { t, tr } = useI18n()
  const playOrPause = () => (playback.isPaused ? t('play') : t('pause'))

  return (
    <div class={[styles.mobilePlaybackControls, styles.safePaddingX]}>
      <div />

      <Button
        label={playOrPause}
        onClick={() => {
          if (playback.isPaused) playback.play()
          else playback.pause()
        }}
      >
        {() => (playback.isPaused ? <IconMsPlayArrowRounded /> : <IconMsPauseRounded />)}
      </Button>

      <div>
        {() =>
          editor.isMobileWorkspace &&
          sync && (
            <div _class={styles.secondaryToolbarGroup}>
              <Button label={tr('undo')} disabled={() => !sync.canUndo} onClick={sync.undo.bind(sync)}>
                <IconMsUndoRounded />
              </Button>

              <Button label={tr('redo')} disabled={() => !sync.canRedo} onClick={sync.redo.bind(sync)}>
                <IconMsRedoRounded />
              </Button>
            </div>
          )
        }
      </div>
    </div>
  )
}
