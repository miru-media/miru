import { IconButton } from 'shared/components/icon-button'
import type { InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils'
import { remap } from 'shared/utils/math'

import type { VideoEditor } from '../video-eidtor.ts'

const MIN_PPS = 0.005
const MIN_MAX_PPS = 0.2

export const SecondaryToolbar = ({ editor }: { editor: VideoEditor }) => {
  const { _movie: movie } = editor
  const { tr } = useI18n()
  const maxPps = () => Math.max(MIN_MAX_PPS, (movie.duration / editor._timelineSize.value.width) * 2)

  return (
    <div class="secondary-toolbar safe-padding-x">
      <div class="secondary-toolbar-group">
        <IconButton
          icon={IconTablerArrowBackUp}
          class="secondary-toolbar-button"
          title={tr('undo')}
          disabled={() => !editor.canUndo}
          onClick={() => editor.undo()}
        >
          <span class="sr-only">{tr('undo')}</span>
        </IconButton>

        <IconButton
          icon={IconTablerArrowForwardUp}
          class="secondary-toolbar-button"
          title={tr('redo')}
          disabled={() => !editor.canRedo}
          onClick={() => editor.redo()}
        >
          <span class="sr-only">{tr('redo')}</span>
        </IconButton>
      </div>

      <label>
        <input
          type="range"
          min="0"
          max="1"
          step="any"
          title={tr('timeline_zoom')}
          value={() => remap(editor._secondsPerPixel.value, MIN_PPS, maxPps(), 1, 0) ** 2}
          onInput={(event: InputEvent) => {
            editor._secondsPerPixel.value = remap(
              Math.sqrt(event.target.valueAsNumber),
              1,
              0,
              MIN_PPS,
              maxPps(),
            )
          }}
        />
        <span class="sr-only">{tr('timeline_zoom')}</span>
      </label>
    </div>
  )
}
