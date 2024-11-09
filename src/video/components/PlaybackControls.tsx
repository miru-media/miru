import { toRef } from '@/framework/reactivity'
import { type InputEvent } from '@/types'
import { type VideoEditor } from '@/video/VideoEditor'

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const { movie } = editor

  return (
    <div class="playback-controls">
      <button
        type="button"
        class="playback-play"
        onClick={() => {
          if (movie.isPaused.value) {
            if (movie.isEnded.value) movie.seekTo(0)
            movie.play()
          } else movie.pause()
        }}
      >
        {() =>
          movie.isPaused.value ? (
            <>
              <IconTablerPlayerPlay />
              <span class="sr-only">Play</span>
            </>
          ) : (
            <>
              <IconTablerPlayerPause />
              <span class="sr-only">Pause</span>
            </>
          )
        }
      </button>

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
