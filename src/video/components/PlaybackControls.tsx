import { toRef } from '@/framework/reactivity'
import { type InputEvent } from '@/types'
import { type VideoEditor } from '@/video/VideoEditor'

import { IconButton } from './IconButton'

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { movie } = editor

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
        min="0.0005"
        max={() => Math.max(0.2, (movie.duration / editor.timelineSize.value.width) * 1.5)}
        step="any"
        value={editor.secondsPerPixel}
        onInput={(event: InputEvent) => {
          editor.secondsPerPixel.value = event.target.valueAsNumber
        }}
      />
    </div>
  )
}
