import { Button } from 'shared/components/button.tsx'
import { SUPPORTS_FULLSCREEN } from 'shared/userAgent.ts'
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
      {SUPPORTS_FULLSCREEN ? (
        <Button label={t('fullscreen')} onClick={() => editor._fullscreen.toggle()}>
          {() =>
            editor._fullscreen.isFullscreen.value ? (
              <IconMsFullscreenExitRounded />
            ) : (
              <IconMsFullscreenRounded />
            )
          }
        </Button>
      ) : (
        <div></div>
      )}

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
