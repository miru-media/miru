import { computed, effect, type MaybeChild, type MaybeRefOrGetter, ref, toValue } from 'fine-jsx'

import { LoadingOverlay } from 'shared/components/LoadingOverlay'
import { type InputEvent } from 'shared/types'
import { useElementSize, useI18n } from 'shared/utils'
import { splitTime } from 'shared/video/utils'

import { ACCEPT_VIDEO_FILE_TYPES } from '../constants'
import { type Clip as ClipType, type Track } from '../nodes'
import { type VideoEditor } from '../VideoEditor'

import { Clip } from './Clip'
import { Ruler } from './Ruler'

const Playhead = ({ editor }: { editor: VideoEditor }) => {
  const root = ref<HTMLElement>()
  const size = useElementSize(root)

  const timeParts = computed(() => splitTime(editor._movie.currentTime))

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
  children?: { empty?: MaybeRefOrGetter<MaybeChild>; tracks?: MaybeRefOrGetter<MaybeChild> }
}) => {
  const { t } = useI18n()
  const root = ref<HTMLElement>()
  const scrollContainer = ref<HTMLElement>()
  const { _movie: movie } = editor

  const rootSize = useElementSize(root)

  effect(() => {
    const { width, height } = rootSize.value
    editor._timelineSize.value = { width: Math.max(width, 1), height: Math.max(height, 1) }
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

    editor.seekTo(editor.pixelsToSeconds((lastScroll = scrollEl.scrollLeft)))
  }

  const totalClips = computed(() => movie.children.reduce((acc, track) => acc + track._count, 0))

  const onInputClipFile = async (event: InputEvent, track: Track<ClipType>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await editor.addClip(track, file)
  }

  const onPointerdownScroller = (event: Event) => {
    if (!(event.target as HTMLElement).closest('.clip')) editor.selectClip(undefined)
  }

  return (
    <div
      ref={root}
      class="timeline"
      style={() => `
          --timeline-width: ${rootSize.value.width}px;
          --timeline-height: ${rootSize.value.height}px;
          --movie-width:${editor.secondsToPixels(Math.max(editor._resize.value?.movieDuration ?? 0, movie.duration))}px`}
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
            movie.children.map(
              (track, trackIndex) =>
                (trackIndex === 0 || !movie.isEmpty) && (
                  <div
                    class="track"
                    style={() => `--track-width: ${editor.secondsToPixels(track.duration)}px;`}
                  >
                    {track.children.map((clip) => (
                      <Clip editor={editor} clip={clip} isSelected={() => editor.selection?.id === clip.id} />
                    ))}
                    <label class="track-button" hidden={totalClips.value === 0 && trackIndex !== 0}>
                      {() =>
                        track._count ? (
                          <>
                            <IconTablerPlus />
                            <span class="sr-only">
                              {track.trackType === 'audio' ? t('add_audio') : t('add_clip')}
                            </span>
                          </>
                        ) : (
                          <>
                            <IconTablerVideo />
                            <span class="text-body">
                              {() =>
                                track.trackType === 'audio' ? t('click_add_audio') : t('click_add_clip')
                              }
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
                ),
            )
          }
          {() =>
            movie.isEmpty && (
              <div class="track">
                <slot name="empty">{toValue(children?.empty)}</slot>
              </div>
            )
          }
        </div>

        <LoadingOverlay loading={() => editor.isLoading} />
      </div>
    </div>
  )
}
