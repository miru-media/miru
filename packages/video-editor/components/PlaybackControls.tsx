import { type InputEvent } from '@/types'
import { remap } from '@/utils/math'

import { type VideoEditor } from '../VideoEditor'

import { ToggleButton } from './ToggleButton'

const MIN_PPS = 0.005

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { movie } = editor
  const maxPps = () => Math.max(0.2, (movie.duration / editor.timelineSize.value.width) * 2)

  return (
    <div class="playback-controls safe-padding-x">
      <ToggleButton
        activeIcon={IconTablerPlayerPlay}
        inactiveIcon={IconTablerPlayerPause}
        class="playback-play"
        isActive={movie.isPaused}
        onToggle={(shouldPause) => {
          if (shouldPause) movie.pause()
          else {
            if (movie.isEnded.value) movie.seekTo(0)
            movie.play()
          }
        }}
      >
        <span class="sr-only">{() => (movie.isPaused.value ? 'Play' : 'Pause')}</span>
      </ToggleButton>

      <input
        type="range"
        min="0"
        max="1"
        step="any"
        value={() => remap(editor.secondsPerPixel.value, MIN_PPS, maxPps(), 1, 0) ** 2}
        onInput={(event: InputEvent) => {
          editor.secondsPerPixel.value = remap(Math.sqrt(event.target.valueAsNumber), 1, 0, MIN_PPS, maxPps())
        }}
      />
    </div>
  )
}
