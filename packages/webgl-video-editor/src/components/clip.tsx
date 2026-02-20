import '@interactjs/actions/resize'
import '@interactjs/actions/drag'
import '@interactjs/modifiers'
import '@interactjs/auto-start'
import type { DragEvent } from '@interactjs/actions/drag/plugin.js'
import type { ResizeEvent } from '@interactjs/actions/resize/plugin.js'
import interact from '@interactjs/interact'
import { computed, effect, ref } from 'fine-jsx'

import { Button } from 'shared/components/button.tsx'
import { stringHashCode, useI18n } from 'shared/utils'

import { MIN_CLIP_DURATION_S, MIN_CLIP_WIDTH_PX } from '../constants.ts'
import styles from '../css/index.module.css'
import type { Clip as ClipType } from '../nodes/index.ts'
import type { VideoEditor } from '../video-editor.ts'

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
    if (!clip.everHadEnoughData) return 'var(--white-2)'

    const hash = stringHashCode(clip.sourceAsset.id)
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
        edges: { left: `.${styles.clipResizeLeft}`, right: `.${styles.clipResizeRight}` },
        modifiers: [
          interact.modifiers.restrictEdges({
            outer: () => {
              const { time, prev } = clip
              const mediaDuration = clip.sourceAsset.duration
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
            editor._untracked(() => {
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
            })
          },
          end() {
            editor._endClipResize()
          },
        },
      },
      drag: {
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: () => ({
              left: 0,
              right: editor.secondsToPixels(editor._movie.duration),
              top: 0,
              bottom: 0,
            }),
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
            editor._untracked(() => {
              editor._drag.x.value = rect.left

              const parent = clip.parent!
              const newStartTime = editor.pixelsToSeconds(rect.left)
              const newCenterTime = newStartTime + clip.time.duration / 2

              let insertBefore: ClipType | undefined
              for (let { prevClip } = clip; prevClip; { prevClip } = prevClip) {
                const { start, duration } = prevClip.time
                if (start >= newStartTime || start + duration / 2 >= newCenterTime)
                  insertBefore = prevClip as ClipType
                else break
              }

              if (insertBefore) {
                clip.position({ parentId: parent.id, index: insertBefore.index })
                return
              }

              const newEndTime = newStartTime + clip.time.duration

              let insertAfter: ClipType | undefined
              for (let { nextClip } = clip; nextClip; { nextClip } = nextClip) {
                const { end, duration } = nextClip.time
                if (end <= newEndTime || end - duration / 2 <= newCenterTime)
                  insertAfter = nextClip as ClipType
                else break
              }
              if (insertAfter) {
                clip.position({ parentId: parent.id, index: insertAfter.index + 1 })
              }
            })
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
        styles.clip,
        isSelected() && [styles.isSelected, editor._drag.isDragging.value && styles.isDragging],
        clip.prev && styles.canResizeLeft,
        clip.next && editor.selection === clip.next && styles.nextIsSelected,
      ]}
      style={() => `
        --clip-box-left: ${boxEdges.value.left}px;
        --clip-box-right: ${boxEdges.value.right}px;
        --drag-offset: ${editor._drag.x.value};
        --clip-color: ${clipColor.value};
      `}
    >
      <div ref={mainContainer} class={styles.clipBox} onClick={() => editor.select(clip.id, false)}>
        <span class={styles.clipName}>{clip.displayName}</span>
        <div class={styles.clipControls}>
          <div class={styles.clipResizeLeft}>
            <IconTablerChevronLeft />
          </div>
          <div class={styles.clipResizeRight}>
            <IconTablerChevronRight />
          </div>
        </div>
      </div>
      {import.meta.env.DEV && (
        <Button
          class={styles.clipTransition}
          label={tr('transition')}
          onClick={() => {
            // eslint-disable-next-line no-alert -- TODO
            alert(t('Not implemented.'))
          }}
        >
          {() => (clip.transition ? <IconTablerChevronsRight /> : <IconTablerChevronRight />)}
        </Button>
      )}
    </div>
  )
}
