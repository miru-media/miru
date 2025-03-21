import { type InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils'
import { remap } from 'shared/utils/math'

import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

const MIN_PPS = 0.005

export const SecondaryToolbar = ({ editor }: { editor: VideoEditor }) => {
  const { _movie: movie } = editor
  const { tr } = useI18n()
  const maxPps = () => Math.max(0.2, (movie.duration / editor._timelineSize.value.width) * 2)

  return (
    <div class="secondary-toolbar safe-padding-x">
      <div class="secondary-toolbar-group">
        <IconButton
          icon={IconTablerArrowBackUp}
          class="secondary-toolbar-button"
          title={tr('Undo')}
          disabled={() => !editor.canUndo}
          onClick={() => editor.undo()}
        >
          <span class="sr-only">{tr('Undo')}</span>
        </IconButton>

        <IconButton
          icon={IconTablerArrowForwardUp}
          class="secondary-toolbar-button"
          title={tr('Redo')}
          disabled={() => !editor.canRedo}
          onClick={() => editor.redo()}
        >
          <span class="sr-only">{tr('Redo')}</span>
        </IconButton>
      </div>

      <label>
        <input
          type="range"
          min="0"
          max="1"
          step="any"
          title={tr('Timeline zoom')}
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
        <span class="sr-only">{tr('Timeline zoom')}</span>
      </label>
    </div>
  )
}
