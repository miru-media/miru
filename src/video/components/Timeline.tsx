import { effect, ref } from '@/framework/reactivity'
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
