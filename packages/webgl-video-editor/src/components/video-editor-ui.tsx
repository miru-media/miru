/* eslint-disable no-alert -- TODO */
import type { Ref } from 'fine-jsx'
import { h } from 'fine-jsx/jsx-runtime'

import { LoadingOverlay } from 'shared/components/loading-overlay'
import type { I18nOptions, InputEvent } from 'shared/types'
import { provideI18n } from 'shared/utils'
import { assertEncoderConfigIsSupported, hasVideoDecoder } from 'shared/video/utils'

import { EXPORT_VIDEO_CODECS, ReadyState, SourceNodeState } from '../constants.ts'
import styles from '../css/index.module.css'
import type { Clip } from '../nodes/clip.ts'
import type { VideoEditor as VideoEditor_ } from '../video-editor.ts'

import { PlaybackControls } from './playback-controls.jsx'
import { SecondaryToolbar } from './secondary-toolbar.jsx'
import { Timeline } from './timeline.jsx'

export const VideoEditorUI = (props: {
  editor: VideoEditor_
  children?: Record<string, Ref>
  i18n?: I18nOptions
}) => {
  const { editor } = props
  const i18n = provideI18n(props.i18n ?? { messages: {} })
  const { t } = i18n

  if (!hasVideoDecoder()) alert(t('error_no_webcodecs'))
  else
    Promise.all(
      EXPORT_VIDEO_CODECS.map((codec) =>
        assertEncoderConfigIsSupported('video', { codec, width: 1920, height: 1080 })
          .then(() => true)
          .catch(() => false),
      ),
    )
      .then((results) => {
        if (!results.some((supported) => supported)) {
          alert(`${t('error_cannot_export')} (${EXPORT_VIDEO_CODECS.join()})`)
        }
      })
      .catch(() => undefined)

  const movie = editor._movie

  return (
    <div class={styles.videoEditor}>
      {() => editor._showStats.value && movie.stats.dom}
      <div class={styles.viewport}>
        {h(movie.canvas, { class: styles.viewportCanvas })}
        <LoadingOverlay loading={() => !movie.isReady} />
        <PlaybackControls editor={editor} />
      </div>

      <SecondaryToolbar editor={editor} />

      <Timeline editor={editor}>{{ empty: props.children?.timelineEmpty }}</Timeline>
      <div class={styles.slot}>{props.children?.default}</div>
      <progress
        style={() => (editor.exportProgress >= 0 ? 'width:100%' : 'display:none')}
        value={() => editor.exportProgress}
      ></progress>

      {() =>
        editor._showStats.value && (
          <div
            class={styles.textBodySmall}
            style={() =>
              `width:100%;
          padding:0.25rem;
          overflow:auto;`
            }
          >
            <p style="display:flex;gap:0.25rem">
              {() =>
                movie.timeline.children.map((track) =>
                  (track.children as Clip[]).map((clip) => {
                    const node = clip.node.value
                    const { mediaState } = node

                    return (
                      <div style="font-family:monospace">
                        <div>
                          {() =>
                            [mediaState.time.value.toFixed(2), mediaState.latestEvent.value?.type].join(' ')
                          }
                        </div>
                        <div>
                          {() => (
                            <>
                              {ReadyState[mediaState.readyState.value]} | {SourceNodeState[node.state]} |{' '}
                              {clip.error.value?.code}
                            </>
                          )}
                        </div>

                        <div>
                          <label>
                            source time
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              value={clip.sourceStart}
                              onInput={(event: InputEvent) => (clip.sourceStart = event.target.valueAsNumber)}
                            />
                          </label>
                          [{() => clip.time.start.toFixed(2)}, {() => clip.time.end.toFixed(2)}]{' | '}
                        </div>
                      </div>
                    )
                  }),
                )
              }
            </p>
          </div>
        )
      }
    </div>
  )
}
