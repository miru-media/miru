import { computed, effect, ref } from '@/framework/reactivity'
import { type InputEvent } from '@/types'
import { useElementSize } from '@/utils'

import { type Clip as ClipType } from '../Clip'
import { splitTime } from '../utils'
import { type VideoEditor } from '../VideoEditor'

import { Clip } from './Clip'

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

const Ruler = ({ editor }: { editor: VideoEditor }) => {
  const intervalS = computed(() => {
    const range = editor.secondsPerPixel.value
    const exponent = Math.floor(Math.log2(range))
    const magnitude = Math.pow(2, exponent)

    return magnitude * 32
  })

  const Markings = () => {
    const style = () => {
      const $intervalS = intervalS.value
      const size = editor.secondsToPixels($intervalS)
      const offset = -size / 2 + ((editor.timelineSize.value.width / 2) % size)

      return `
        --ruler-interval: ${size}px;
        --ruler-markings-offset: ${offset}px;
      `
    }

    return <div class="ruler-markings" style={style}></div>
  }

  const Labels = () => {
    const LABEL_SPACING = 5

    const getChildren = () => {
      const timelineWidth = editor.timelineSize.value.width
      const timelineRangeS = editor.pixelsToSeconds(timelineWidth)

      const children: JSX.Element[] = []
      const labelIntervalS = intervalS.value * LABEL_SPACING
      const nLabels = Math.ceil(timelineRangeS / labelIntervalS) + 1

      let fromS = Math.max(editor.movie.currentTime - timelineRangeS / 2, 0)
      fromS = fromS - (fromS % labelIntervalS)

      for (let i = 0; i < nLabels; i++) {
        const time = fromS + i * labelIntervalS

        const left = editor.secondsToPixels(time) + timelineWidth / 2
        children.push(
          <div class="ruler-label text-small" style={`translate:calc(${left}px - 50%)`}>
            {time}s
          </div>,
        )
      }

      return children
    }

    return <div>{getChildren}</div>
  }

  return (
    <div class="ruler">
      <Markings />
      <Labels />
    </div>
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

  const onInputClipFile = async (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return
    await editor.addClip(file)
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
                      <input type="file" accept="video/*" onInput={onInputClipFile} />
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
