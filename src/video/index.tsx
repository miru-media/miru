// eslint-disable-next-line import/no-unresolved -- remote
import sampleVideo from 'https://media.xiph.org/video/derf/webm/Netflix_SquareAndTimelapse_4096x2160_60fps_10bit_420.webm'

import { render } from '@/framework/jsx-runtime'
import { ref } from '@/framework/reactivity'
import { decodeAsyncImageSource } from '@/utils'

import { Movie } from './Movie'

const Demo = () => {
  const RESOLUTION = { width: 1920, height: 1080 }
  const movie = new Movie({
    tracks: [
      {
        clips: [
          {
            time: { start: 0, source: 0, duration: 4 },
            x: 0,
            y: 0,
            width: RESOLUTION.width,
            height: RESOLUTION.height,
            source: sampleVideo,
            effects: [],
          },
        ],
      },
    ],
    resolution: RESOLUTION,
  })

  const getClip = () => movie.tracks.value[0].clips.value[0]

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
                if (!blob) throw new Error('no blob')

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
            if (!blob) return

            return (
              <button type="button" onClick={() => window.open(URL.createObjectURL(blob))}>
                View {blob.type}
              </button>
            )
          }}
          <div class="font-mono">
            <div>{getClip().etro.value.latestEvent}</div>
            <div>
              state: {getClip().etro.value.readyState}, error?: {() => getClip().etro.value.error.value?.code}
            </div>
          </div>
        </p>

        <button
          type="button"
          onClick={() => {
            getClip().effects.value = []
            if (movie.isPaused.value) movie.refresh().catch(() => undefined)
          }}
        >
          no effect
        </button>
        {() =>
          movie.effects.value.map((effect) => (
            <button
              type="button"
              onClick={() => {
                getClip().effects.value = [effect]
                if (movie.isPaused.value) movie.refresh().catch(() => undefined)
              }}
            >
              {effect.name}
            </button>
          ))
        }
      </div>
    </>
  )
}

const { media } = decodeAsyncImageSource(sampleVideo, undefined, true)

render(
  <>
    {media}
    <Demo />
  </>,
  document.getElementById('app')!,
)
