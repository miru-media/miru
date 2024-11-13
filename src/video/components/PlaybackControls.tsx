import { toRef } from '@/framework/reactivity'
import { type InputEvent } from '@/types'
import { remap } from '@/utils/math'
import { type VideoEditor } from '@/video/VideoEditor'

import { IconButton } from './IconButton'

const MIN_PPS = 0.005

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { movie } = editor
  const maxPps = () => Math.max(0.2, (movie.duration / editor.timelineSize.value.width) * 2)

  return (
    <div class="playback-controls">
      <IconButton
        icon={toRef(() => (movie.isPaused.value ? IconTablerPlayerPlay : IconTablerPlayerPause))}
        class="playback-play"
        onClick={() => {
          if (movie.isPaused.value) {
            if (movie.isEnded.value) movie.seekTo(0)
            movie.play()
          } else movie.pause()
        }}
      >
        <span class="sr-only">{() => (movie.isPaused.value ? 'Play' : 'Pause')}</span>
      </IconButton>

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
