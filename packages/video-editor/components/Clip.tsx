import '@interactjs/actions/resize'
import '@interactjs/actions/drag'
import '@interactjs/modifiers'
import '@interactjs/auto-start'
import { type DragEvent } from '@interactjs/actions/drag/plugin'
import { type ResizeEvent } from '@interactjs/actions/resize/plugin'
import interact from '@interactjs/interact'
import { computed, effect, ref, toRef } from 'fine-jsx'

import { stringHashCode } from 'shared/utils'

import { type Clip as ClipType } from '../Clip'
import { MIN_CLIP_DURATION_S, MIN_CLIP_WIDTH_PX } from '../constants'
import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

const CLIP_COLORS = [
  'var(--red-dark)',
  'var(--red)',
  'var(--red-light)',
  'var(--purple)',
  'var(--purple-light)',
  'var(--green)',
  'var(--green-light)',
]

export const Clip = ({
  clip,
  editor,
  isSelected,
}: {
  clip: ClipType
  editor: VideoEditor
  isSelected: () => boolean
}) => {
  const mainContainer = ref<HTMLElement>()
  const clipColor = computed(() => {
    const hash = stringHashCode(clip.media.value.src)
    return CLIP_COLORS[Math.abs(hash) % CLIP_COLORS.length]
  })

  const boxEdges = computed(() => {
    const { time, prev, next, transition } = clip
    const drag = editor.drag.value

    // start, end offsets meeting at the centers of transition overlaps
    const startPx = isSelected() && drag.isDragging ? drag.x : editor.secondsToPixels(time.start)
    const left = startPx + editor.secondsToPixels((prev?.transition?.duration ?? 0) / 2)
    const width = Math.max(
      MIN_CLIP_WIDTH_PX,
      editor.secondsToPixels(time.duration - (next && transition ? transition.duration : 0) / 2),
    )
    const right = Math.max(left + MIN_CLIP_WIDTH_PX, startPx + width)

    return { left, right }
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
              const maxEndTime = time.start + mediaDuration

              return {
                left: editor.secondsToPixels(minStartTime),
                right: editor.secondsToPixels(maxEndTime),
                top: 0,
                bottom: 0,
              }
            },
            inner: () => {
              const { time } = clip
              const minDuration = MIN_CLIP_DURATION_S + (clip.transition?.duration ?? 0)

              return {
                left: editor.secondsToPixels(time.end - minDuration),
                right: editor.secondsToPixels(time.start + minDuration),
                top: 0,
                bottom: 0,
              }
            },
          }),
        ],
        listeners: {
          start() {
            editor.movie.pause()
            editor.resize.value = {
              movieDuration: editor.movie.duration,
            }
          },
          move({ rect, edges }: ResizeEvent) {
            const { prev } = clip
            const newStart = editor.pixelsToSeconds(rect.left)
            const newDuration = editor.pixelsToSeconds(rect.width)

            if (edges?.left === true) {
              const delta = newDuration - clip.duration.value
              clip.sourceStart.value = Math.max(0, clip.sourceStart.value - delta)
            }

            clip.duration.value = newDuration

            if (edges?.right === true) clip.ensureDurationIsPlayable()

            if (prev) prev.duration.value = newStart - prev.time.start + (prev.transition?.duration ?? 0)
          },
          end() {
            editor.resize.value = undefined
          },
        },
      },
      drag: {
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: () => {
              return { left: 0, right: editor.secondsToPixels(editor.movie.duration), top: 0, bottom: 0 }
            },
          }),
        ],
        startAxis: 'x',
        listeners: {
          start({ rect, interaction }: DragEvent) {
            if (!isSelected()) {
              interaction.stop()
              return
            }
            editor.drag.value = { x: rect.left, isDragging: true }
            editor.selectClip(clip)
          },
          move({ rect }: DragEvent) {
            editor.drag.value = { x: rect.left, isDragging: true }
            const newStartTime = editor.pixelsToSeconds(rect.left)
            const newCenterTime = newStartTime + clip.time.duration / 2

            let insertBefore: ClipType | undefined
            for (let prev = clip.prev; prev; prev = prev.prev) {
              const { start, duration } = prev.time
              if (start >= newStartTime || start + duration / 2 >= newCenterTime) insertBefore = prev
              else break
            }

            if (insertBefore) {
              clip.track.insertClipBefore(clip, insertBefore)
              return
            }

            const newEndTime = newStartTime + clip.time.duration

            let insertAfter: ClipType | undefined
            for (let next = clip.next; next; next = next.next) {
              const { end, duration } = next.time
              if (end <= newEndTime || end - duration / 2 <= newCenterTime) insertAfter = next
              else break
            }
            if (insertAfter) {
              clip.track.insertClipBefore(clip, insertAfter.next)
              return
            }
          },
          end() {
            editor.drag.value = { x: 0, isDragging: false }
          },
        },
      },
    })

    onCleanup(() => {
      interactable.unset()
    })
  })

  return (
    <div
      class={() => [
        'clip',
        isSelected() && ['is-selected', editor.drag.value.isDragging && 'is-dragging'],
        clip.prev && 'can-resize-left',
        clip.next && editor.selected.value === clip.next && 'next-is-selected',
      ]}
      style={() =>
        `--clip-box-left:${boxEdges.value.left}px;--clip-box-right:${boxEdges.value.right}px;--drag-offset:${editor.drag.value.x};--clip-color:${clipColor.value}`
      }
    >
      <div ref={mainContainer} class="clip-box" onClick={() => editor.selectClip(clip)}>
        {clip.track.type === 'audio' ? 'Audio' : 'Clip'} {() => clip.index + 1}
        <div class="clip-controls">
          <div class="clip-resize-left">
            <IconTablerChevronLeft />
          </div>
          <div class="clip-resize-right">
            <IconTablerChevronRight />
          </div>
        </div>
      </div>
      {import.meta.env.DEV && (
        <IconButton
          icon={toRef(() => (clip.transition ? IconTablerChevronsRight : IconTablerChevronRight))}
          class="clip-transition"
          title="Transition"
          onClick={() => {
            alert('Not implemented.')
          }}
        >
          <span class="sr-only">Transition</span>
        </IconButton>
      )}
    </div>
  )
}
