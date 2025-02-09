import { type VideoEditor } from '../VideoEditor'

import { ToggleButton } from './ToggleButton'

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { movie } = editor
  const playOrPause = () => (movie.isPaused.value ? 'Play' : 'Pause')

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
          else {
            if (movie.isEnded.value) movie.seekTo(0)
            movie.play()
          }
        }}
      >
        <span class="sr-only">{playOrPause}</span>
      </ToggleButton>
    </div>
  )
}
