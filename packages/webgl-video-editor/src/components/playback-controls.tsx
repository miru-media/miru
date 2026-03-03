import type { VideoEditor } from '#core'
import { Button } from 'shared/components/button.tsx'
import { useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { playback } = editor
  const { t } = useI18n()
  const playOrPause = () => (playback.isPaused ? t('play') : t('pause'))

  return (
    <div class={[styles.playbackControls, styles.safePaddingX]}>
      <Button
        class={[styles.square, styles.overlay]}
        label={playOrPause}
        onClick={() => {
          if (playback.isPaused) playback.play()
          else playback.pause()
        }}
      >
        {() => (playback.isPaused ? <IconTablerPlayerPlay /> : <IconTablerPlayerPause />)}
      </Button>
    </div>
  )
}
