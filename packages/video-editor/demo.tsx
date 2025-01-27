import { h } from 'fine-jsx'
/* eslint-disable import/no-unresolved */
import turtle from 'https://assets.miru.media/turtle-PaulsAdventures-pixabay.mp4'
import waveBreaking from 'https://assets.miru.media/wave-breaking-EclipseChasers-pixabay.mp4'
import waves from 'https://assets.miru.media/waves-MustaKor-pixabay.mp4'
import wavesRocks from 'https://assets.miru.media/waves-rocks-McPix22-pixabay.mp4'
/* eslint-enable import/no-unresolved */

import { type InputEvent } from 'shared/types'

import { Clip } from './Clip'
import * as Actions from './components/Actions'
import { PlaybackControls } from './components/PlaybackControls'
import { renderComponentTo } from './components/renderTo'
import { Settings } from './components/Settings'
import { Timeline } from './components/Timeline'
import { type Movie } from './Movie'
import { Track } from './Track'
import { VideoEditor } from './VideoEditor'

const demoMovie: Movie.Init = {
  tracks: [
    {
      clips: [
        {
          sourceStart: 2,
          duration: 3,
          source: waves,
        },
        {
          sourceStart: 2,
          duration: 4,
          source: wavesRocks,
        },
        {
          sourceStart: 3,
          duration: 3,
          source: waveBreaking,
        },
        {
          sourceStart: 22.18,
          duration: 5,
          source: turtle,
        },
        {
          sourceStart: 0,
          duration: 2,
          source: waves,
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
  const loadDemo = () => {
    movie.resolution = demoMovie.resolution
    movie.frameRate.value = demoMovie.frameRate
    movie.tracks.value.forEach((track) => track.dispose())
    movie.tracks.value = demoMovie.tracks.map((init) => new Track(init, movie, Clip))
  }

  return (
    <div class="video-editor">
      {() => editor.showStats.value && movie.stats.dom}
      <div class="viewport">{h(movie.displayCanvas, { class: 'viewport-canvas' })}</div>

      <Settings editor={editor} />
      <PlaybackControls editor={editor} />
      <Timeline
        editor={editor}
        children={{
          tracks: () =>
            movie.isEmpty && (
              <button
                type="button"
                class="add-clip"
                style="left: calc(50% + 1rem); margin-top: 3.5rem;"
                onClick={loadDemo}
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
            movie.tracks.value[0].mapClips((clip) => (
              <div style="font-family:monospace">
                <div>
                  {() => [clip.media.value.currentTime.toFixed(2), clip.latestEvent.value?.type].join(' ')}
                </div>
                <div>
                  {() => (
                    <>
                      state: {clip.node.value.state}, error?: {clip.error.value?.code}
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
                      onInput={(event: InputEvent) => (clip.sourceStart.value = event.target.valueAsNumber)}
                    />
                  </label>
                  <div>
                    <label>
                      source
                      <input
                        type="file"
                        accept="video"
                        onInput={(event: InputEvent) => {
                          const file = event.target.files?.[0]
                          if (!file) return

                          clip.setMedia(URL.createObjectURL(file))
                        }}
                      />
                    </label>
                  </div>
                  [{() => clip.time.start.toFixed(2)}, {() => clip.time.end.toFixed(2)}]{' | '}
                  {() => clip.transition?.duration.toFixed(2)}
                </div>
              </div>
            ))
          }
        </p>
      </div>
    </div>
  )
}

renderComponentTo(Demo, {}, document.getElementById('app')!)
