import { Button } from 'shared/components/button.tsx'
import { useI18n } from 'shared/utils'

import type { VideoEditor } from '../video-editor.ts'

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { _movie: movie } = editor
  const { t } = useI18n()
  const playOrPause = () => (movie.isPaused.value ? t('play') : t('pause'))

  return (
    <div class="playback-controls safe-padding-x">
      <Button
        class="square overlay"
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
