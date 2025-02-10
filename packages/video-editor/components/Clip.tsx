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
    if (!clip.everHadEnoughData) return 'var(--gray)'

    const hash = stringHashCode(clip.media.value.src)
    return CLIP_COLORS[Math.abs(hash) % CLIP_COLORS.length]
  })

  const boxEdges = computed(() => {
    const { time } = clip
    const { isDragging, x } = editor.drag

    const left = isSelected() && isDragging.value ? x.value : editor.secondsToPixels(time.start)
    const right = left + Math.max(MIN_CLIP_WIDTH_PX, editor.secondsToPixels(time.duration))

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
              const minDuration = MIN_CLIP_DURATION_S

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
            editor.startResize(clip)
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

            if (prev) prev.duration.value = newStart - prev.time.start
          },
          end() {
            editor.endResize()
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

            editor.startDrag(clip)
            editor.drag.x.value = rect.left
          },
          move({ rect }: DragEvent) {
            editor.drag.x.value = rect.left
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
            editor.endDrag()
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
        isSelected() && ['is-selected', editor.drag.isDragging.value && 'is-dragging'],
        clip.prev && 'can-resize-left',
        clip.next && editor.selected === clip.next && 'next-is-selected',
      ]}
      style={() =>
        `--clip-box-left:${boxEdges.value.left}px;--clip-box-right:${boxEdges.value.right}px;--drag-offset:${editor.drag.x.value};--clip-color:${clipColor.value}`
      }
    >
      <div ref={mainContainer} class="clip-box" onClick={() => editor.select(clip)}>
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
