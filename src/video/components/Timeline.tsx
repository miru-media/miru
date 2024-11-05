import { computed, effect, ref } from '@/framework/reactivity'
import { type InputEvent } from '@/types'
import { useElementSize } from '@/utils'

import { type Clip as ClipType } from '../Clip'
import { formatTime } from '../utils'
import { type VideoEditor } from '../VideoEditor'

import { Clip } from './Clip'

const Cursor = ({ editor }: { editor: VideoEditor }) => {
  const root = ref<HTMLElement>()
  const size = useElementSize(root)

  const getStyle = () => {
    return `left: ${editor.timelineSize.value.width / 2 - size.value.width / 2}px`
  }
  return (
    <div
      ref={root}
      class="absolute flex flex-col items-center p-0.25rem pointer-events-none"
      style={getStyle}
    >
      <span class="rounded bg-yellow text-black">{() => formatTime(editor.movie.currentTime)}</span>
      <div class="w-2px bg-yellow" style={() => `height: ${editor.timelineSize.value.height}px`} />
    </div>
  )
}

const Ruler = ({ editor }: { editor: VideoEditor }) => {
  const intervalS = computed(() => {
    const range = editor.secondsPerPixel.value
    const exponent = Math.floor(Math.log2(range))
    const magnitude = Math.pow(2, exponent)

    return magnitude * 32
  })

  const Labels = () => {
    return (
      <div>
        {() => {
          const timelineRangeS = editor.pixelsToSeconds(editor.timelineSize.value.width)
          const spacing = 4

          const children: JSX.Element[] = []
          const labelIntervalS = intervalS.value * spacing
          const nLabels = Math.ceil(timelineRangeS / labelIntervalS) + 1

          let fromS = Math.max(editor.movie.currentTime - timelineRangeS / 2, 0)
          fromS = fromS - (fromS % labelIntervalS)

          for (let i = 0; i < nLabels; i++) {
            const time = fromS + i * labelIntervalS
            if (time > editor.movie.duration + timelineRangeS / 2.1) break

            const left = editor.secondsToPixels(time)
            children.push(
              <div class="absolute" style={`translate:${left}px`}>
                {time}s
              </div>,
            )
          }

          return children
        }}
      </div>
    )
  }

  const style = () => `
    height: 1rem;
    width: calc(100% + ${editor.timelineSize.value.width / 2.1}px);
    background-size: ${editor.secondsToPixels(intervalS.value)}px 1rem;
    background-image: radial-gradient(circle at 0 center, white 0.125rem, rgba(0, 0, 0, 0) 0.125rem);
    `

  return (
    <>
      <div class="absolute left-0 top-0" style={style}></div>
      <Labels />
    </>
  )
}

export const Timeline = ({ editor }: { editor: VideoEditor }) => {
  const root = ref<HTMLElement>()
  const scrollContainer = ref<HTMLElement>()
  const { movie, secondsPerPixel } = editor

  const rootSize = useElementSize(root)

  effect(() => {
    const { width, height } = rootSize.value
    editor.timelineSize.value = { width: Math.max(width, 1), height: Math.max(height, 1) }
  })

  let lastScroll = 0

  effect(() => {
    const scrollEl = scrollContainer.value
    if (!scrollEl) return

    scrollEl.scrollLeft = lastScroll = Math.round(editor.secondsToPixels(movie.currentTime))
  })

  const onScroll = () => {
    const scrollEl = scrollContainer.value
    if (!scrollEl || scrollEl.scrollLeft === lastScroll) return

    const time = editor.pixelsToSeconds((lastScroll = scrollEl.scrollLeft))
    editor.seekTo(time)
  }

  const ClipList = ({ clip }: { clip: ClipType | undefined }) => {
    // TODO: allow returning null
    return clip ? (
      <>
        <Clip editor={editor} clip={clip} />
        <ClipList clip={clip.next} />
      </>
    ) : (
      <></>
    )
  }

  return (
    <div ref={root}>
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

      <Cursor editor={editor} />

      <input
        type="range"
        min="0.001"
        max={() => (movie.duration / rootSize.value.width) * 1.25}
        step="any"
        value={secondsPerPixel}
        onInput={(event: InputEvent) => (secondsPerPixel.value = event.target.valueAsNumber)}
      />
      <div ref={scrollContainer} class="overflow-x-auto" onScroll={onScroll}>
        <div
          style={() =>
            `padding: 0 ${rootSize.value.width / 2}px;width:${editor.secondsToPixels(movie.duration) + rootSize.value.width}px`
          }
        >
          <div class="relative" style={`width:${editor.secondsToPixels(movie.duration)}px`}>
            <Ruler editor={editor} />
            {() =>
              movie.tracks.value.map((track) => (
                <div class="flex relative h-4rem">
                  <ClipList clip={track.head} />
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
