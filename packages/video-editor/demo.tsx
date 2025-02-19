import { effect, h, onScopeDispose } from 'fine-jsx'

import { assertEncoderConfigIsSupported, hasVideoDecoder } from 'shared/transcode/utils'
import { type InputEvent } from 'shared/types'
import { isElement, provideI18n, useEventListener, win } from 'shared/utils'

import * as Actions from './components/Actions'
import { LoadingOverlay } from './components/LoadingOverlay'
import { PlaybackControls } from './components/PlaybackControls'
import { renderComponentTo } from './components/renderTo'
import { SecondaryToolbar } from './components/SecondaryToolbar'
import { Settings } from './components/Settings'
import { Timeline } from './components/Timeline'
import { EXPORT_VIDEO_CODECS, ReadyState, SourceNodeState } from './constants'
import { demoMovie } from './demoMovie'
import de from './locales/de.json'
import { type Clip, type Schema } from './nodes'
import { VideoEditor } from './VideoEditor'

const LOCAL_STORAGE_PREFIX = 'video-editor:'

const Demo = () => {
  const { t } = provideI18n({ translations: { de } })

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

  const editor = new VideoEditor()
  const { movie } = editor

  onScopeDispose(() => editor.dispose())

  {
    // restore movie from localStorage
    const movieContentKey = `${LOCAL_STORAGE_PREFIX}content`
    const savedJson = localStorage.getItem(movieContentKey)

    if (savedJson) {
      editor
        .replaceMovie(JSON.parse(savedJson) as Schema.Movie)
        // eslint-disable-next-line no-console
        .catch(() => console.warn(`[video-editor] Couldn't restore content`, savedJson))
    }

    // persist movie to localStorage
    effect(() => {
      if (editor.isLoading) return
      localStorage.setItem(movieContentKey, JSON.stringify(movie.toObject()))
    })
  }

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

    const selectClip = (clip?: Clip) => {
      if (!clip) return
      editor.select(clip)

      const { start, end } = clip.time
      if (movie.currentTime < start) movie.seekTo(start)
      else if (movie.currentTime >= end) movie.seekTo(end - 1 / movie.frameRate.value)

      event.preventDefault()
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
        editor.delete()
        break

      case 'KeyS':
        if (event.repeat) break
        editor.splitAtCurrentTime()
        break

      case 'ArrowLeft':
        selectClip(editor.selected?.prev)
        break

      case 'ArrowRight':
        selectClip(editor.selected?.next)
        break
    }
  })

  return (
    <div class="video-editor">
      {() => editor.showStats.value && movie.stats.dom}
      <div class="viewport">
        {h(movie.displayCanvas, { class: 'viewport-canvas' })}
        <LoadingOverlay loading={() => !movie.isReady} />
        <PlaybackControls editor={editor} />
      </div>

      <SecondaryToolbar editor={editor} />

      <Settings editor={editor} />
      <Timeline
        editor={editor}
        children={{
          tracks: () =>
            movie.isEmpty &&
            !editor.isLoading && (
              <button
                type="button"
                class="add-clip"
                style="left: calc(50% + 1rem); margin-top: 3.5rem;"
                onClick={() => editor.replaceMovie(demoMovie)}
              >
                {t('Load sample movie')}
              </button>
            ),
        }}
      />
      <Actions.ClipActions editor={editor} />
      <progress
        style={() => (editor.exportProgress.value >= 0 ? 'width:100%' : 'display:none')}
        value={editor.exportProgress}
      ></progress>

      <div
        class="text-body-small"
        style={() =>
          `width:100%;
          padding:0.25rem;
          overflow:auto;
          display:${editor.showStats.value ? 'block' : 'none'}`
        }
      >
        <p style="display:flex;gap:0.25rem">
          {() =>
            movie.children.value.map((track) =>
              track.mapClips((clip) => {
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
                          onInput={(event: InputEvent) =>
                            (clip.sourceStart.value = event.target.valueAsNumber)
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
    </div>
  )
}

export const mountDemo = (root: HTMLElement) => renderComponentTo(Demo, {}, root)
