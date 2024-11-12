import { computed, effect, ref } from '@/framework/reactivity'
import { type InputEvent } from '@/types'
import { useElementSize } from '@/utils'

import { type Clip as ClipType } from '../Clip'
import { type Track } from '../Track'
import { splitTime } from '../utils'
import { type VideoEditor } from '../VideoEditor'

import { Clip } from './Clip'
import { Ruler } from './Ruler'

const Playhead = ({ editor }: { editor: VideoEditor }) => {
  const root = ref<HTMLElement>()
  const size = useElementSize(root)

  const timeParts = computed(() => splitTime(editor.movie.currentTime))

  return (
    <>
      <div ref={root} class="timeline-playhead" style={() => `--time-pill-width: ${size.value.width}px`}>
        <span class="time-pill text-body-small">
          <span class="time-pill-left">
            <span class="time-pill-digits">{() => timeParts.value.hours}</span>:
            <span class="time-pill-digits">{() => timeParts.value.minutes}</span>
          </span>
          <span class="time-pill-right">
            <span class="time-pill-digits">{() => timeParts.value.seconds}</span>.
            <span class="time-pill-digits">{() => timeParts.value.subSeconds}</span>
          </span>

          <svg class="time-pill-drop" viewBox="0 0 16 8" fill="none">
            <path
              d="M7.99282 8C7.99282 8 10.3614 0 15.3381 0C20.3147 0 -4.57808 0 0.753127 0C6.08433 0 7.99282 8 7.99282 8Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>
      <div class="timeline-cursor" />
    </>
  )
}

export const Timeline = ({ editor }: { editor: VideoEditor }) => {
  const root = ref<HTMLElement>()
  const scrollContainer = ref<HTMLElement>()
  const { movie } = editor

  const rootSize = useElementSize(root)

  effect(() => {
    const { width, height } = rootSize.value
    editor.timelineSize.value = { width: Math.max(width, 1), height: Math.max(height, 1) }
  })

  let lastScroll = 0
  const scrollIsClose = () => Math.abs(lastScroll - (scrollContainer.value?.scrollLeft ?? 0)) < 1

  effect(() => {
    const scrollEl = scrollContainer.value
    const newScroll = editor.secondsToPixels(movie.currentTime)
    if (!scrollEl || lastScroll === newScroll) return

    scrollEl.scrollLeft = newScroll
    lastScroll = scrollEl.scrollLeft
  })

  const onScroll = () => {
    const scrollEl = scrollContainer.value
    if (!scrollEl || scrollIsClose()) return

    const time = Math.max(0, editor.pixelsToSeconds((lastScroll = scrollEl.scrollLeft)))
    // clamp to exclude 0 and the movie duration so that a frame is always rendered
    editor.seekTo(Math.max(0.0001, Math.min(time, movie.duration - 0.001)))
  }

  const ClipList = ({ clip }: { clip: ClipType | undefined }) => {
    // TODO: allow returning null
    return clip ? (
      <>
        <Clip editor={editor} clip={clip} isSelected={() => editor.selected.value === clip} />
        <ClipList clip={clip.next} />
      </>
    ) : (
      <></>
    )
  }

  const onInputClipFile = async (event: InputEvent, track: Track) => {
    const file = event.target.files?.[0]
    if (!file) return
    await editor.addClip(track, file)
  }

  const onPointerdownScroller = (event: Event) => {
    if (!(event.target as HTMLElement).closest('.clip')) editor.selectClip(undefined)
  }

  return (
    <>
      <div
        ref={root}
        class="timeline"
        style={() => `
          --timeline-width: ${rootSize.value.width}px;
          --timeline-height: ${rootSize.value.height}px;
          --movie-width:${editor.secondsToPixels(Math.max(editor.resize.value?.movieDuration ?? 0, movie.duration))}px`}
      >
        <Playhead editor={editor} />

        <div
          ref={scrollContainer}
          class="timeline-scroller"
          onScroll={onScroll}
          onPointerdown={onPointerdownScroller}
        >
          <Ruler editor={editor} />

          <div class="track-list">
            {() =>
              movie.tracks.value.length ? (
                movie.tracks.value.map((track) => (
                  <div class="track">
                    <ClipList clip={track.head} />
                    <label type="button" class="add-clip">
                      {() =>
                        track.count ? (
                          <>
                            <IconTablerPlus />
                            <span class="sr-only">Add a clip</span>
                          </>
                        ) : (
                          <>
                            <IconTablerVideo />
                            <span class="text-body">Click to add a clip</span>
                          </>
                        )
                      }
                      <input
                        type="file"
                        hidden
                        accept="video/*"
                        onInput={(event) => onInputClipFile(event, track)}
                      />
                    </label>
                  </div>
                ))
              ) : (
                <div class="track" />
              )
            }
          </div>
        </div>
      </div>
    </>
  )
}
