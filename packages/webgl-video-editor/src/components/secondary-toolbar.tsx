import { Button } from 'shared/components/button.tsx'
import type { InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils'
import { remap } from 'shared/utils/math'

import styles from '../css/index.module.css'
import type { VideoEditor } from '../video-editor.ts'

const MIN_PPS = 0.005
const MIN_MAX_PPS = 0.2

export const SecondaryToolbar = ({ editor }: { editor: VideoEditor }) => {
  const { _doc: doc, store } = editor
  const { tr } = useI18n()
  const maxPps = () => Math.max(MIN_MAX_PPS, (doc.duration / editor._timelineSize.value.width) * 2)

  return (
    <div class={[styles.secondaryToolbar, styles.safePaddingX]}>
      {!!store && (
        <div class={styles.secondaryToolbarGroup}>
          <Button
            class={[styles.square, styles.secondaryToolbarButton]}
            label={tr('undo')}
            disabled={() => !store.canUndo}
            onClick={store.undo.bind(store)}
          >
            <IconTablerArrowBackUp />
          </Button>

          <Button
            class={[styles.square, styles.secondaryToolbarButton]}
            label={tr('redo')}
            disabled={() => !store.canRedo}
            onClick={store.redo.bind(store)}
          >
            <IconTablerArrowForwardUp />
          </Button>
        </div>
      )}

      <input
        type="range"
        min="0"
        max="1"
        step="any"
        title={tr('timeline_zoom')}
        aria-label={tr('timeline_zoom')}
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
    </div>
  )
}
