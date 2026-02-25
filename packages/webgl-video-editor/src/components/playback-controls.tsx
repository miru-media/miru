import { Button } from 'shared/components/button.tsx'
import { useI18n } from 'shared/utils'

import styles from '../css/index.module.css'
import type { VideoEditor } from '../video-editor.ts'

export const PlaybackControls = ({ editor }: { editor: VideoEditor }) => {
  const doc = editor._doc
  const { t } = useI18n()
  const playOrPause = () => (doc.isPaused.value ? t('play') : t('pause'))

  return (
    <div class={[styles.playbackControls, styles.safePaddingX]}>
      <Button
        class={[styles.square, styles.overlay]}
        label={playOrPause}
        onClick={() => {
          if (doc.isPaused.value) doc.play()
          else doc.pause()
        }}
      >
        {() => (doc.isPaused.value ? <IconTablerPlayerPlay /> : <IconTablerPlayerPause />)}
      </Button>
    </div>
  )
}
