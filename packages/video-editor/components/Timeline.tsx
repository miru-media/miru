import { computed, effect, type MaybeChild, type MaybeRefOrGetter, ref } from 'fine-jsx'

import { type InputEvent } from 'shared/types'
import { useElementSize } from 'shared/utils'

import { type Clip as ClipType } from '../Clip'
import { ACCEPT_VIDEO_FILE_TYPES } from '../cosntants'
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
        <span class="time-pill text-body-small numeric">
          <span>
            {() => timeParts.value.hours}:{() => timeParts.value.minutes}
          </span>
          <span class="time-pill-right">
            {() => timeParts.value.seconds}.{() => timeParts.value.subSeconds}
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

export const Timeline = ({
  editor,
  children,
}: {
  editor: VideoEditor
  children?: { tracks?: MaybeRefOrGetter<MaybeChild> }
}) => {
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

  const totalClips = computed(() => movie.tracks.value.reduce((acc, track) => acc + track.count, 0))

  const onInputClipFile = async (event: InputEvent, track: Track<ClipType>) => {
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
                movie.tracks.value.map((track, trackIndex) => (
                  <div
                    class="track"
                    style={() => `--track-width: ${editor.secondsToPixels(track.duration)}px;`}
                  >
                    <ClipList clip={track.head} />
                    <label class="add-clip" hidden={totalClips.value === 0 && trackIndex !== 0}>
                      {() =>
                        track.count ? (
                          <>
                            <IconTablerPlus />
                            <span class="sr-only">{track.type === 'audio' ? 'Add audio' : 'Add a clip'}</span>
                          </>
                        ) : (
                          <>
                            <IconTablerVideo />
                            <span class="text-body">
                              {track.type === 'audio' ? 'Click to add audio' : 'Click to add a clip'}
                            </span>
                          </>
                        )
                      }
                      <input
                        type="file"
                        hidden
                        accept={ACCEPT_VIDEO_FILE_TYPES}
                        onInput={(event: InputEvent) => onInputClipFile(event, track)}
                      />
                    </label>
                  </div>
                ))
              ) : (
                <div class="track" />
              )
            }
            {children?.tracks}
          </div>
        </div>
      </div>
    </>
  )
}
