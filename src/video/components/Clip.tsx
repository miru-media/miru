import '@interactjs/actions/resize'
import '@interactjs/modifiers'
import '@interactjs/auto-start'
import { type ResizeEvent } from '@interactjs/actions/resize/plugin'
import interact from '@interactjs/interact'

import { MIN_CLIP_DURATION_S } from '@/constants'
import { computed, effect, ref, toRef } from '@/framework/reactivity'

import { type Clip as ClipType } from '../Clip'
import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const Clip = ({ clip, editor }: { clip: ClipType; editor: VideoEditor }) => {
  const mainContainer = ref<HTMLElement>()
  const isSelected = computed(() => editor.selected.value === clip)

  const boxEdges = computed(() => {
    const { time, prev, next, transition } = clip

    // start, end offsets meeting at the centers of transition overlaps
    return {
      left: editor.secondsToPixels(time.start + (prev?.transition?.duration ?? 0) / 2),
      right: editor.secondsToPixels(time.end - (next && transition ? transition.duration : 0) / 2),
    }
  })

  effect((onCleanup) => {
    const element = mainContainer.value
    if (!element) return

    const interactable = interact(element, {
      getRect() {
        const { time } = clip
        const left = editor.secondsToPixels(time.start)
        const right = editor.secondsToPixels(time.end)
        const { top, bottom } = element.getBoundingClientRect()

        return { left, right, top, bottom }
      },
      resize: {
        edges: { left: '.clip-resize-left', right: '.clip-resize-right' },
        modifiers: [
          interact.modifiers.restrictEdges({
            outer: () => {
              const { time, media, prev } = clip
              const mediaDuration = media.value.duration || time.duration
              const minStartTime = Math.max(
                time.end - mediaDuration,
                Math.max(0, prev ? prev.time.start + MIN_CLIP_DURATION_S : 0),
              )
              const maxEndTime = time.start + (mediaDuration - time.source)

              return {
                left: editor.secondsToPixels(minStartTime),
                right: editor.secondsToPixels(maxEndTime),
                top: -Infinity,
                bottom: Infinity,
              }
            },
            inner: () => {
              const { time } = clip

              return {
                left: editor.secondsToPixels(time.end - MIN_CLIP_DURATION_S),
                right: editor.secondsToPixels(time.start + MIN_CLIP_DURATION_S),
                top: -Infinity,
                bottom: Infinity,
              }
            },
          }),
        ],
        listeners: {
          start() {
            editor.movie.pause()
            editor.stateBeforeClipResize.value = {
              movieDuration: editor.movie.duration,
              inTransitionDuration: clip.prev?.transition?.duration ?? 0,
              outTransitionDuration: clip.transition?.duration ?? 0,
            }
          },
          move({ rect }: ResizeEvent) {
            const { prev } = clip
            const newStart = editor.pixelsToSeconds(rect.left)

            // TODO: correct source offset time
            clip.duration.value = editor.pixelsToSeconds(rect.width)

            if (prev) prev.duration.value = newStart - prev.time.start + (prev.transition?.duration ?? 0)
          },
          end() {
            editor.stateBeforeClipResize.value = undefined
          },
        },
      },
    })

    onCleanup(() => interactable.unset())
  })

  return (
    <div
      class={() => [
        'clip',
        isSelected.value && 'is-selected',
        clip.prev && 'has-prev',
        clip.next && 'has-next',
        clip.next && editor.selected.value === clip.next && 'next-is-selected',
      ]}
      style={() => `--clip-box-left:${boxEdges.value.left}px;--clip-box-right:${boxEdges.value.right}px`}
    >
      <div ref={mainContainer} class="clip-box" onClick={() => editor.selectClip(clip)}>
        Clip {() => clip.index}
        <div class="clip-controls">
          <div class="clip-resize-left">
            <IconTablerChevronLeft />
          </div>
          <div class="clip-resize-right">
            <IconTablerChevronRight />
          </div>
        </div>
      </div>
      <IconButton
        icon={toRef(() => (clip.transition ? IconTablerChevronsRight : IconTablerChevronRight))}
        class="clip-transition"
        onClick={() => {
          alert('Not implemented.')
        }}
      />
    </div>
  )
}
