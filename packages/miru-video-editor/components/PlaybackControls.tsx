import { useI18n } from 'shared/utils'

import { type VideoEditor } from '../VideoEditor'

import { ToggleButton } from './ToggleButton'

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { _movie: movie } = editor
  const { t } = useI18n()
  const playOrPause = () => (movie.isPaused.value ? t('Play') : t('Pause'))

  return (
    <div class="playback-controls safe-padding-x">
      <ToggleButton
        activeIcon={IconTablerPlayerPlay}
        inactiveIcon={IconTablerPlayerPause}
        class="playback-play dark"
        title={playOrPause}
        isActive={movie.isPaused}
        onToggle={(shouldPause) => {
          if (shouldPause) movie.pause()
          else movie.play()
        }}
      >
        <span class="sr-only">{playOrPause}</span>
      </ToggleButton>
    </div>
  )
}
