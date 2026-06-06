import { Button } from 'shared/components/button.tsx'
import { useI18n } from 'shared/utils'
import { SKIP_S } from 'shared/video/constants.ts'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const DesktopPlaybackControls = () => {
  const editor = useEditor()
  const { t } = useI18n()
  const playOrPause = () => (editor.playback.isPaused ? t('play') : t('pause'))

  return (
    <div class={styles.playbackControlsOverlay}>
      <Button onClick={() => editor.seekTo(editor.currentTime - SKIP_S)}>
        <IconMsFastRewindOutlineRounded />
      </Button>
      <Button
        label={playOrPause}
        onClick={() => {
          const { playback } = editor
          if (playback.isPaused) playback.play()
          else playback.pause()
        }}
      >
        {() => (editor.playback.isPaused ? <IconMsPlayArrowRounded /> : <IconMsPauseRounded />)}
      </Button>

      <Button onClick={() => editor.seekTo(editor.currentTime + SKIP_S)}>
        <IconMsFastForwardOutlineRounded />
      </Button>
    </div>
  )
}
