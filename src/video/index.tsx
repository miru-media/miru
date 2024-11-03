import { filesize } from 'filesize'
/* eslint-disable import/no-unresolved */
import sampleVideo1 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/BigBuckBunnyVideo.mp4'
import sampleVideo2 from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/TearsOfSteelVideo.mp4'
/* eslint-enable import/no-unresolved */

import { getDefaultFilters } from '@/effects'
import { h, render } from '@/framework/jsx-runtime'
import { ref } from '@/framework/reactivity'
import { InputEvent } from '@/types'

import { Movie } from './Movie'

const filters = getDefaultFilters()

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
          },
          {
            time: { start: 2, source: 20, duration: 2.5 },
            x: 0,
            y: 0,
            width: RESOLUTION.width,
            height: RESOLUTION.height,
            source: sampleVideo2,
            filter: filters[1],
          },
          {
            time: { start: 4, source: 4, duration: 4 },
            x: 0,
            y: 0,
            width: RESOLUTION.width,
            height: RESOLUTION.height,
            source: sampleVideo1,
            filter: filters[5],
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

  const recordedBlob = ref<Blob>()

  return (
    <div class="flex flex-col h-screen overflow-hidden">
      {h(movie.displayCanvas, { class: 'flex-1 w-full h-full object-contain' })}
      <div>{() => movie.currentTime.toFixed(2)}</div>
      <input
        type="range"
        class="w-full m-0"
        min={0}
        max={movie.duration}
        step="any"
        value={() => movie.currentTime}
        onInput={(event: InputEvent) => movie.seekTo(event.target.valueAsNumber)}
      />

      {() =>
        movie.tracks.value.map((track, trackIndex) => (
          <>
            <div>Track {trackIndex + 1}</div>
            <div class="flex relative h-4rem">
              {() =>
                track.clips.value.map((clip, clipIndex) => {
                  const getStyle = () => {
                    const time = clip.time.value
                    const left = `${(time.start * 100) / movie.duration}%`
                    const width = `${(time.duration * 100) / movie.duration}%`
                    return `left:${left}; width:${width}`
                  }

                  return (
                    <div class="absolute bg-#8888 text-black h-full rounded" style={getStyle}>
                      CLIP {clipIndex + 1}
                    </div>
                  )
                })
              }
            </div>
          </>
        ))
      }

      <div class="w-full p-2 flex-shrink-0 overflow-auto">
        <p class="flex gap-3">
          <button
            type="button"
            class="flex items-center text-xl"
            onClick={() => {
              if (movie.isPaused.value) {
                if (movie.isEnded.value) movie.seekTo(0)
                movie.play()
              } else movie.pause()
            }}
          >
            {() =>
              movie.isPaused.value
                ? ['Play', <IconTablerPlayerPlayFilled />]
                : ['Pause', <IconTablerPlayerPauseFilled />]
            }
          </button>
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
            movie.tracks.value[0].clips.value.map((clip) => (
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
                    start time
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.25"
                      value={() => clip.time.value.start}
                      onInput={(event: InputEvent) => clip.setTime({ start: event.target.valueAsNumber })}
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
                      value={() => clip.time.value.source}
                      onInput={(event: InputEvent) => clip.setTime({ source: event.target.valueAsNumber })}
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
    </div>
  )
}

render(
  <>
    <Demo />
  </>,
  document.getElementById('app')!,
)
