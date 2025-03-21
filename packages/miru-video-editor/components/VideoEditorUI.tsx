import { h } from 'fine-jsx/jsx-runtime'

import { assertEncoderConfigIsSupported, hasVideoDecoder } from 'shared/transcode/utils'
import { type I18nOptions, type InputEvent } from 'shared/types'
import { isElement, provideI18n, useEventListener, win } from 'shared/utils'

import { EXPORT_VIDEO_CODECS, ReadyState, SourceNodeState } from '../constants'
import { type VideoEditor as VideoEditor_ } from '../VideoEditor'

import * as Actions from './Actions'
import { LoadingOverlay } from './LoadingOverlay'
import { PlaybackControls } from './PlaybackControls'
import { SecondaryToolbar } from './SecondaryToolbar'
import { Settings } from './Settings'
import { Timeline } from './Timeline'

export const VideoEditorUI = ({ editor, i18n }: { editor: VideoEditor_; i18n?: I18nOptions }) => {
  const { t } = provideI18n(i18n ?? { messages: {} })

  if (!hasVideoDecoder()) alert(t(`Your browser doesn't have the WebCodec APIs needed to export videos!`))
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
          alert(
            `${t(`Your browser can't export videos in the formats that we use.`)} (${EXPORT_VIDEO_CODECS.join()})`,
          )
        }
      })
      .catch(() => undefined)

  const movie = editor._movie

  useEventListener(win, 'keydown', (event: KeyboardEvent) => {
    const target = event.composedPath()[0]

    if (isElement(target) && target.closest('select,input,textarea,[contenteditable=true]')) return

    if (event.ctrlKey) {
      switch (event.code) {
        case 'KeyZ': {
          if (event.shiftKey) editor.redo()
          else editor.undo()
          event.preventDefault()
          break
        }
        case 'KeyY': {
          editor.redo()
          event.preventDefault()
          break
        }
      }
      return
    }

    switch (event.code) {
      case 'Space':
      case 'MediaPlayPause':
        if (event.repeat) break
        if (movie.isPaused.value) movie.play()
        else movie.pause()
        event.preventDefault()
        break

      case 'Delete':
        editor.deleteSelection()
        break

      case 'KeyS':
        if (event.repeat) break
        editor.splitClipAtCurrentTime()
        break

      case 'ArrowLeft':
        editor.selectPrevClip()
        event.preventDefault()
        break

      case 'ArrowRight':
        editor.selectNextClip()
        event.preventDefault()
        break
    }
  })

  return (
    <div class="video-editor">
      {() => editor._showStats.value && movie.stats.dom}
      <div class="viewport">
        {h(movie.canvas, { class: 'viewport-canvas' })}
        <LoadingOverlay loading={() => !movie.isReady} />
        <PlaybackControls editor={editor} />
      </div>

      <SecondaryToolbar editor={editor} />

      <Settings editor={editor} />
      <Timeline editor={editor} />
      <Actions.ClipActions editor={editor} />
      <progress
        style={() => (editor.exportProgress >= 0 ? 'width:100%' : 'display:none')}
        value={() => editor.exportProgress}
      ></progress>

      <div
        class="text-body-small"
        style={() =>
          `width:100%;
          padding:0.25rem;
          overflow:auto;
          display:${editor._showStats.value ? 'block' : 'none'}`
        }
      >
        <p style="display:flex;gap:0.25rem">
          {() =>
            movie.children.map((track) =>
              track._mapClips((clip) => {
                const node = clip.node.value
                const { mediaState } = node

                return (
                  <div style="font-family:monospace">
                    <div>
                      {() => [mediaState.time.value.toFixed(2), mediaState.latestEvent.value?.type].join(' ')}
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
    </div>
  )
}
