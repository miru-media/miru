import { h } from 'fine-jsx'
/* eslint-disable import/no-unresolved */
import turtle from 'https://assets.miru.media/demo/turtle-PaulsAdventures-pixabay.mp4'
import underwaterAudio from 'https://assets.miru.media/demo/underwater-ambience-freesound_community-pixabay.mp3'
import waveBreaking from 'https://assets.miru.media/demo/wave-breaking-EclipseChasers-pixabay.mp4'
import wavesAudio from 'https://assets.miru.media/demo/waves-breaking-Dia_Pazon-pixabay.mp3'
import waves from 'https://assets.miru.media/demo/waves-MustaKor-pixabay.mp4'
import wavesRocks from 'https://assets.miru.media/demo/waves-rocks-McPix22-pixabay.mp4'
/* eslint-enable import/no-unresolved */
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { assertEncoderConfigIsSupported, hasVideoDecoder } from 'shared/transcode/utils'
import { type InputEvent } from 'shared/types'
import { isElement, useEventListener } from 'shared/utils'

import { type Clip } from './Clip'
import * as Actions from './components/Actions'
import { LoadingOverlay } from './components/LoadingOverlay'
import { PlaybackControls } from './components/PlaybackControls'
import { renderComponentTo } from './components/renderTo'
import { SecondaryToolbar } from './components/SecondaryToolbar'
import { Settings } from './components/Settings'
import { Timeline } from './components/Timeline'
import { EXPORT_VIDEO_CODEC, ReadyState, SourceNodeState } from './constants'
import { type Movie } from './Movie'
import { VideoEditor } from './VideoEditor'

if (!hasVideoDecoder()) alert(`Your browser doesn't have the WebCodec APIs needed to export videos!`)
else
  assertEncoderConfigIsSupported('video', { codec: EXPORT_VIDEO_CODEC, width: 1920, height: 1080 }).catch(
    (error: unknown) => alert(String((error as any)?.message)),
  )

const filters = new Map(getDefaultFilterDefinitions().map((filter) => [filter.id, filter]))

const demoMovie: Movie.Init = {
  tracks: [
    {
      type: 'video',
      clips: [
        {
          sourceStart: 3,
          duration: 3,
          source: waves,
          filter: filters.get('Chromatic'),
          filterIntensity: 0.3,
        },
        {
          sourceStart: 2,
          duration: 4,
          source: wavesRocks,
          filter: filters.get('Crispy Cyan'),
          filterIntensity: 0.5,
        },
        {
          sourceStart: 3,
          duration: 3,
          source: waveBreaking,
          filter: filters.get('Chromatic'),
          filterIntensity: 0.75,
        },
        {
          sourceStart: 2.18,
          duration: 5,
          source: turtle,
          filter: filters.get('Vintage'),
          filterIntensity: 0.3,
        },
        {
          sourceStart: 1,
          duration: 2,
          source: waves,
          filter: filters.get('Chromatic'),
          filterIntensity: 0.3,
        },
      ],
    },
    {
      type: 'audio',
      clips: [
        {
          sourceStart: 19,
          duration: 10,
          source: wavesAudio,
        },
        {
          sourceStart: 0,
          duration: 5,
          source: underwaterAudio,
        },
        {
          sourceStart: 16,
          duration: 2,
          source: wavesAudio,
        },
      ],
    },
  ],
  resolution: { width: 1080, height: 1920 },
  frameRate: 24,
}

const Demo = () => {
  const editor = new VideoEditor()

  const { movie } = editor
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
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
            movie.isEmpty && (
              <button
                type="button"
                class="add-clip"
                style="left: calc(50% + 1rem); margin-top: 3.5rem;"
                onClick={() => editor.replaceMovie(demoMovie)}
              >
                Load sample movie
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
            movie.tracks.value.map((track) =>
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
                      {() => clip.transition?.duration.toFixed(2)}
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

renderComponentTo(Demo, {}, document.getElementById('app')!)
