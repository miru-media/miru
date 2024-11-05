import { filesize } from 'filesize'
/* eslint-disable import/no-unresolved */
import sampleVideo1 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/BigBuckBunnyVideo.mp4'
import sampleVideo2 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/TearsOfSteelVideo.mp4'
/* eslint-enable import/no-unresolved */

import { getDefaultFilters } from '@/effects'
import { h, render } from '@/framework/jsx-runtime'
import { ref } from '@/framework/reactivity'
import { type InputEvent } from '@/types'

import * as Actions from './components/Actions'
import { Timeline } from './components/Timeline'
import { VideoEditor } from './VideoEditor'

const filters = getDefaultFilters()

const Demo = () => {
  const RESOLUTION = { width: 1920, height: 1080 }
  const editor = new VideoEditor({
    tracks: [
      {
        clips: [
          {
            sourceStart: 5,
            duration: 3,
            source: sampleVideo1,
            transition: { duration: 1, type: 'CROSSFADE' },
          },
          {
            sourceStart: 20,
            duration: 2.5,
            source: sampleVideo2,
            filter: filters[1],
            transition: { duration: 0.5, type: 'HORIZONTAL_WIPE' },
          },
          {
            sourceStart: 4,
            duration: 4,
            source: sampleVideo1,
            filter: filters[5],
          },
        ],
      },
    ],
    resolution: RESOLUTION,
  })

  const { movie } = editor
  const recordedBlob = ref<Blob>()

  return (
    <div class="flex flex-col h-screen overflow-hidden">
      {h(movie.displayCanvas, { class: 'flex-1 w-full h-full object-contain max-h-70vh' })}

      <Timeline editor={editor} />
      <Actions.ClipActions editor={editor} />

      <div class="w-full p-2 flex-shrink-0 overflow-auto">
        <p class="flex gap-3">
          <button
            class="hidden"
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
              <div class="font-mono">
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
                    duration
                    <input
                      type="number"
                      min="0.25"
                      max="20"
                      step="0.25"
                      value={clip.duration}
                      onInput={(event: InputEvent) => (clip.duration.value = event.target.valueAsNumber)}
                    />
                  </label>
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
                    </div>{' '}
                  </label>
                </div>
              </div>
            ))
          }
        </p>
      </div>
    </div>
  )
}

render(<Demo />, document.getElementById('app')!)
