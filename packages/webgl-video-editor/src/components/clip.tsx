import '@interactjs/actions/resize/index.js'
import '@interactjs/actions/drag/index.js'
import '@interactjs/modifiers/index.js'
import '@interactjs/auto-start/index.js'
import { type DragEvent } from '@interactjs/actions/drag/plugin.js'
import { type ResizeEvent } from '@interactjs/actions/resize/plugin.js'
import interact from '@interactjs/interact'
import { computed, effect, ref, toRef } from 'fine-jsx'

import { IconButton } from 'shared/components/icon-button'
import { stringHashCode, useI18n } from 'shared/utils'

import { MIN_CLIP_DURATION_S, MIN_CLIP_WIDTH_PX } from '../constants'
import { type Clip as ClipType } from '../nodes'
import { type VideoEditor } from '../VideoEditor'

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
  const { t, tr } = useI18n()
  const mainContainer = ref<HTMLElement>()
  const clipColor = computed(() => {
    if (!clip.everHadEnoughData) return 'var(--gray)'

    const hash = stringHashCode(clip.source.id)
    return CLIP_COLORS[Math.abs(hash) % CLIP_COLORS.length]
  })

  const boxEdges = computed(() => {
    const { time } = clip
    const { isDragging, x } = editor._drag

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
            editor._startClipResize(clip)
          },
          move({ rect, edges }: ResizeEvent) {
            const { prev } = clip
            const newStart = editor.pixelsToSeconds(rect.left)
            const newDuration = editor.pixelsToSeconds(rect.width)

            if (edges?.left === true) {
              const delta = newDuration - clip.duration
              clip.sourceStart = Math.max(0, clip.sourceStart - delta)
            }

            clip.duration = newDuration

            if (edges?.right === true) clip._ensureDurationIsPlayable()

            if (prev) prev.duration = newStart - prev.time.start
          },
          end() {
            editor._endClipResize()
          },
        },
      },
      drag: {
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: () => {
              return { left: 0, right: editor.secondsToPixels(editor._movie.duration), top: 0, bottom: 0 }
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

            editor._startClipDrag(clip)
            editor._drag.x.value = rect.left
          },
          move({ rect }: DragEvent) {
            editor._drag.x.value = rect.left
            const newStartTime = editor.pixelsToSeconds(rect.left)
            const newCenterTime = newStartTime + clip.time.duration / 2

            let insertBefore: ClipType | undefined
            for (let prev = clip.prev; prev; prev = prev.prev) {
              const { start, duration } = prev.time
              if (start >= newStartTime || start + duration / 2 >= newCenterTime) insertBefore = prev
              else break
            }

            if (insertBefore) {
              clip.parent.insertClipBefore(clip, insertBefore)
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
              clip.parent.insertClipBefore(clip, insertAfter.next)
              return
            }
          },
          end() {
            editor._endClipDrag()
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
        isSelected() && ['is-selected', editor._drag.isDragging.value && 'is-dragging'],
        clip.prev && 'can-resize-left',
        clip.next && editor.selection === clip.next && 'next-is-selected',
      ]}
      style={() =>
        `--clip-box-left:${boxEdges.value.left}px;--clip-box-right:${boxEdges.value.right}px;--drag-offset:${editor._drag.x.value};--clip-color:${clipColor.value}`
      }
    >
      <div ref={mainContainer} class="clip-box" onClick={() => editor.selectClip(clip.id, false)}>
        <span class="clip-name">{clip.displayName}</span>
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
          title={tr('transition')}
          onClick={() => {
            alert(t('Not implemented.'))
          }}
        >
          <span class="sr-only">Transition</span>
        </IconButton>
      )}
    </div>
  )
}
