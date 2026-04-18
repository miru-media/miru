/* eslint-disable no-alert -- TODO */
import type { Ref } from 'fine-jsx'
import { h } from 'fine-jsx/jsx-runtime'

import type { VideoEditor } from '#core'
import { LoadingOverlay } from 'shared/components/loading-overlay'
import type { I18nOptions, InputEvent } from 'shared/types'
import { provideI18n, Rational } from 'shared/utils'
import { ReadyState } from 'shared/video/constants.ts'
import { assertEncoderConfigIsSupported, hasVideoDecoder } from 'shared/video/utils'

import { AssetBin, EXPORT_VIDEO_CODECS } from '../constants.ts'
import styles from '../css/index.module.css'
import type { PlaybackDocument } from '../document-views/playback/playback-document.ts'

import { AssetBinAudio } from './asset-bin-audio.jsx'
import { AssetBinVideo } from './asset-bin-video.jsx'
import { AssetBinFonts } from './asset-bin-fonts.jsx'
import { PlaybackControls } from './playback-controls.jsx'
import { SecondaryToolbar } from './secondary-toolbar.jsx'
import { Timeline } from './timeline.jsx'
import { TransformControls } from './transform-controls.jsx'
import { provideEditor } from './utils.ts'

export const VideoEditorUI = (props: {
  editor: VideoEditor
  children?: Record<string, Ref>
  i18n?: I18nOptions
}): JSX.Element => {
  const { editor } = props
  const i18n = provideI18n(props.i18n ?? { messages: {} })
  const { t } = i18n

  provideEditor(editor._editor)

  if (hasVideoDecoder())
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
  else alert(t('error_no_webcodecs'))

  const { doc } = editor
  const playback = editor.playback as unknown as PlaybackDocument

  return (
    <div class={styles.videoEditor}>
      {() => editor._showStats && playback.stats.dom}
      <div
        class={styles.viewport}
        style={() =>
          `--viewport-width:${editor.viewportSize.width}px;--viewport-height:${editor.viewportSize.height}px;`
        }
      >
        {h(editor.canvas, { class: styles.viewportCanvas })}
        <TransformControls />
        <LoadingOverlay loading={() => !playback.isReady} />
        <PlaybackControls />
      </div>

      <SecondaryToolbar />

      <Timeline>{{ empty: props.children?.timelineEmpty }}</Timeline>
      {() => editor.activeAssetBin === AssetBin.video && <AssetBinVideo />}
      {() => editor.activeAssetBin === AssetBin.audio && <AssetBinAudio />}
      {() => editor.activeAssetBin === AssetBin.fonts && <AssetBinFonts />}
      <div class={styles.slot}>{props.children?.default}</div>
      <progress
        style={() => (editor.exportProgress >= 0 ? 'width:100%' : 'display:none')}
        value={() => editor.exportProgress}
      ></progress>

      {() =>
        editor._showStats && (
          <div class={styles.textBodySmall} style={() => `width:100%; padding:0.25rem; overflow:auto;`}>
            <p style="display:flex;gap:0.25rem">
              {() =>
                doc.timeline.children.map((track) =>
                  track.children.map((clip) => {
                    if (!clip.isMediaClip()) return null

                    const playbackClip = playback._getNode(clip)
                    const { mediaState } = playbackClip

                    return (
                      <div style="font-family:monospace">
                        <div>
                          {() =>
                            [
                              playbackClip.mediaTime.value.toFixed(2),
                              mediaState.latestEvent.value?.type,
                            ].join(' ')
                          }
                        </div>
                        <div>
                          {() => (
                            <>
                              {Object.keys(ReadyState).find(
                                (key) =>
                                  ReadyState[key as keyof typeof ReadyState] === mediaState.readyState.value,
                              )}{' '}
                              | {playbackClip.mediaState.error.value?.code}
                            </>
                          )}
                        </div>

                        <div>
                          <label>
                            source time{' '}
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              value={() => clip.sourceStart.valueOf()}
                              onInput={(event: InputEvent) =>
                                (clip.sourceStart = Rational.fromDecimal(
                                  event.target.valueAsNumber,
                                  clip.sourceStart.rate,
                                ))
                              }
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
