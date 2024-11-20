import { h } from '@/framework/jsx-runtime'
import { ref } from '@/framework/reactivity'
import { type InputEvent } from '@/types'
import { filesize } from 'filesize'
/* eslint-disable import/no-unresolved */
import sampleVideo1 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/BigBuckBunnyVideo.mp4'
import sampleVideo2 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/TearsOfSteelVideo.mp4'
/* eslint-enable import/no-unresolved */
import { getDefaultFilters } from 'miru-image-editor/defaultFilters'

import * as Actions from './components/Actions'
import { PlaybackControls } from './components/PlaybackControls'
import { renderComponentTo } from './components/renderTo'
import { Settings } from './components/Settings'
import { Timeline } from './components/Timeline'
import { VideoEditor } from './VideoEditor'

const filters = getDefaultFilters()

const Demo = () => {
  const RESOLUTION = { width: 1080, height: 1920 }
  const editor = new VideoEditor({
    tracks: [
      {
        clips: import.meta.env.DEV
          ? [
              {
                sourceStart: 5,
                duration: 3,
                source: sampleVideo1,
                transition: { type: 'CROSSFADE' },
              },
              {
                sourceStart: 20,
                duration: 2.5,
                source: sampleVideo2,
                filter: filters[1],
                transition: { type: 'HORIZONTAL_WIPE' },
              },
              {
                sourceStart: 4,
                duration: 4,
                source: sampleVideo1,
                filter: filters[5],
              },
            ]
          : [],
      },
    ],
    resolution: RESOLUTION,
    frameRate: 60,
  })

  const { movie } = editor
  const recordedBlob = ref<Blob>()

  return (
    <div class="video-editor">
      {() => editor.showStats.value && movie.stats.dom}
      <div class="viewport">{h(movie.displayCanvas, { class: 'viewport-canvas' })}</div>

      <Settings editor={editor} />
      <PlaybackControls editor={editor} />
      <Timeline editor={editor} />
      <Actions.ClipActions editor={editor} />

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
          <button
            style="display:none"
            type="button"
            onClick={async () => {
              movie.pause()
              recordedBlob.value = undefined
              try {
                const blob = await movie.record()
                if (blob == undefined) throw new Error('no blob')

                recordedBlob.value = blob
              } catch (error: unknown) {
                alert(error)
              }
            }}
          >
            Record
          </button>
          {() => {
            const blob = recordedBlob.value
            if (blob == undefined) return

            return (
              <button type="button" onClick={() => window.open(URL.createObjectURL(blob))}>
                {blob.type}
                <br />
                {filesize(blob.size)}
              </button>
            )
          }}
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
                  [{() => clip.time.start.toFixed(2)}, {() => clip.time.end.toFixed(2)}] |{' '}
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
