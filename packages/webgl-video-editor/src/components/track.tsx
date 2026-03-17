import { computed } from 'fine-jsx'

import { ACCEPT_VIDEO_FILE_TYPES } from '#constants'
import type * as pub from '#core'
import type { InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils/index.js'

import styles from '../css/index.module.css'

import { Clip } from './clip.jsx'
import { useEditor } from './utils.js'

export const Track = ({
  track,
  onInputClipFile,
  ...props
}: {
  track: pub.Track
  onInputClipFile: (event: InputEvent, track?: pub.Track) => unknown
  [index: string]: unknown
}): JSX.Element => {
  const editor = useEditor()
  const { t } = useI18n()
  const hasAnyClips = computed(() => editor.doc.timeline.children.some((track) => !!track.firstClip))

  return (
    <div
      {...props}
      class={styles.track}
      style={() => `--track-width: ${editor.secondsToPixels(track.duration.valueOf())}px;`}
    >
      {() =>
        track.clips.map((clip) => (
          <Clip editor={editor} clip={clip} isSelected={() => editor.selection?.id === clip.id} />
        ))
      }
      <label
        class={() => [styles.trackButton, track.clipCount > 0 && styles.square]}
        hidden={() => !hasAnyClips.value && track.index !== 0}
      >
        {() =>
          track.clipCount ? (
            <>
              <IconTablerPlus />
              <span class={styles.srOnly}>
                {track.trackType === 'audio' ? t('add_audio') : t('add_clip')}
              </span>
            </>
          ) : (
            <>
              <IconTablerVideo />
              <span class={styles.textBody}>
                {() => (track.trackType === 'audio' ? t('click_add_audio') : t('click_add_clip'))}
              </span>
            </>
          )
        }
        <input
          type="file"
          class={styles.srOnly}
          accept={ACCEPT_VIDEO_FILE_TYPES}
          onInput={(event: InputEvent) => onInputClipFile(event, track)}
        />
      </label>
    </div>
  )
}
