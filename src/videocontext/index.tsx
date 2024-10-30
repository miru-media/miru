import { filesize } from 'filesize'
/* eslint-disable import/no-unresolved */
import sampleVideo1 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/BigBuckBunnyVideo.mp4'
import sampleVideo2 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/TearsOfSteelVideo.mp4'
/* eslint-enable import/no-unresolved */

import { render } from '@/framework/jsx-runtime'
import { ref } from '@/framework/reactivity'
import { InputEvent } from '@/types'

import { Movie } from './Movie'

const Demo = () => {
  const RESOLUTION = { width: 1920, height: 1080 }
  const movie = new Movie({
    tracks: [
      {
        clips: [
          {
            time: { start: 0, source: 5, duration: 3 },
            x: 0,
            y: 0,
            width: RESOLUTION.width,
            height: RESOLUTION.height,
            source: sampleVideo1,
            effects: [],
          },
          {
            time: { start: 2, source: 20, duration: 3 },
            x: 0,
            y: 0,
            width: RESOLUTION.width,
            height: RESOLUTION.height,
            source: sampleVideo2,
            effects: [],
          },
          {
            time: { start: 4, source: 4, duration: 4 },
            x: 0,
            y: 0,
            width: RESOLUTION.width,
            height: RESOLUTION.height,
            source: sampleVideo1,
            effects: [],
          },
        ],
        transitions: [
          // { clips: [-1, 0], start: 0, duration: 1, type: 'CROSSFADE' },
          { clips: [0, 1], start: 2, duration: 1, type: 'CROSSFADE' },
          { clips: [1, 2], start: 4, duration: 0.5, type: 'HORIZONTAL_WIPE' },
        ],
      },
    ],
    resolution: RESOLUTION,
  })

  movie.displayCanvas.className = 'w-full h-85vh max-w-screen max-h-screen object-contain'
  const recordedBlob = ref<Blob>()

  return (
    <>
      <div>{movie.displayCanvas}</div>
      <input
        type="range"
        class="w-full m-0"
        min={0}
        max={movie.duration}
        step="any"
        value={() => movie.currentTime}
        onInput={(event: InputEvent) => movie.seekTo(event.target.valueAsNumber)}
      />
      <div class="fixed bottom-0 left-0 bg-#0004 max-w-full p-2 text-white">
        <p class="flex gap-3">
          {() =>
            movie.isPaused.value ? (
              <button
                type="button"
                onClick={() => {
                  if (movie.isEnded.value) movie.seekTo(0)
                  movie.play()
                }}
              >
                Play
              </button>
            ) : (
              <button type="button" onClick={() => movie.pause()}>
                Pause
              </button>
            )
          }
          <button
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
            movie.tracks.value[0].clips.value.map((clip) => (
              <div class="font-mono">
                {() => (
                  <>
                    <div>
                      {[clip.node.value._currentTime.toFixed(2), clip.latestEvent.value?.type].join(' ')}
                    </div>
                    <div>
                      state: {clip.node.value.state}, error?: {clip.error.value?.code}
                    </div>
                  </>
                )}

                {/*
                <select
                  size="3"
                  onChange={(event: Event & { target: HTMLSelectElement }) => {
                    clip.effects.value = [...event.target.selectedOptions]
                      .map((option) => movie.effects.value[parseInt(option.value)])
                      .filter(Boolean)
                    if (movie.isPaused.value) movie.refresh().catch(() => undefined)
                  }}
                >
                  <option type="button" value="-1">
                    no effect
                  </option>
                  {() =>
                    movie.effects.value.map((effect, i) => (
                      <option value={i} selected={() => clip.effects.value.includes(effect)}>
                        {effect.name}
                      </option>
                    ))
                  }
                </select>
                */}
              </div>
            ))
          }
        </p>
      </div>
    </>
  )
}

render(
  <>
    <Demo />
  </>,
  document.getElementById('app')!,
)
