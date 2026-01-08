import { Button } from 'shared/components/button.tsx'
import { useI18n } from 'shared/utils'

import styles from '../css/index.module.css'
import type { VideoEditor } from '../video-editor.ts'

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { _movie: movie } = editor
  const { t } = useI18n()
  const playOrPause = () => (movie.isPaused.value ? t('play') : t('pause'))

  return (
    <div class={[styles.playbackControls, styles.safePaddingX]}>
      <Button
        class={[styles.square, styles.overlay]}
        label={playOrPause}
        onClick={() => {
          if (movie.isPaused.value) movie.play()
          else movie.pause()
        }}
      >
        {() => (movie.isPaused.value ? <IconTablerPlayerPlay /> : <IconTablerPlayerPause />)}
      </Button>
    </div>
  )
}
