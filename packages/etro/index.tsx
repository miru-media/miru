import { filesize } from 'filesize'
/* eslint-disable import/no-unresolved */
import sampleVideo1 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/BigBuckBunnyVideo.mp4'
import sampleVideo2 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/TearsOfSteelVideo.mp4'
/* eslint-enable import/no-unresolved */

import { render } from '@/framework/jsx-runtime'
import { ref } from '@/framework/reactivity'

import { Movie } from './Movie'

const Demo = () => {
  const RESOLUTION = { width: 1920, height: 1080 }
  const movie = new Movie({
    tracks: [
      {
        clips: [
          {
            time: { start: 0, source: 30, duration: 7 },
            x: 0,
            y: 0,
            width: RESOLUTION.width,
            height: RESOLUTION.height,
            source: sampleVideo1,
            effects: [],
          },
          {
            time: { start: 5, source: 30, duration: 20 },
            x: 0,
            y: 0,
            width: RESOLUTION.width,
            height: RESOLUTION.height,
            source: sampleVideo2,
            effects: [],
          },
        ],
      },
    ],
    resolution: RESOLUTION,
  })

  movie.displayCanvas.className = 'w-full h-full max-w-screen max-h-screen objet-fit-contain'
  const recordedBlob = ref<Blob>()

  return (
    <>
      <div>{movie.displayCanvas}</div>
      <div class="fixed bottom-0 left-0 bg-#0004 max-w-full p-2 text-white">
        <p class="flex gap-3">
          {() =>
            movie.isPaused.value ? (
              <button type="button" onClick={() => movie.play()}>
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
                <div>
                  {() =>
                    [
                      clip.etro.value.source.currentTime.toFixed(2),
                      clip.etro.value.latestEvent.value?.type,
                    ].join(' ')
                  }
                </div>
                <div>
                  state: {clip.etro.value.readyState}, error?: {() => clip.etro.value.error.value?.code}
                </div>
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
