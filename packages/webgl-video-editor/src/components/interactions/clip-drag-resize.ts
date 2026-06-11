import type { DragEvent } from '@interactjs/actions/drag/plugin.js'
import type { ResizeEvent } from '@interactjs/actions/resize/plugin.js'
import interact from '@interactjs/interact'
import { effect, ref } from 'fine-jsx'

import type { ClipResize } from '#internal'
import { Rational } from 'shared/utils/math.ts'

import styles from '../../css/index.module.css'
import type { EditView } from '../../document-views/edit/edit-nodes.ts'
import type { VideoEditor } from '../../video-editor.ts'
import { ensureDurationIsPlayable } from '../utils.ts'

const GAPPED = true as boolean

export const useClipDragResize = (editor: VideoEditor): { resize: ClipResize } => {
  const resize: ClipResize = {
    docDuration: ref(0),
    isResizing: ref(false),
    clips: [undefined, undefined as never, undefined],
  }

  const getSelectedClip = (): EditView.AnyClip | undefined => {
    const { selection, doc } = editor
    if (selection?.isNode && selection.isClip()) return doc._getNode(selection)
  }

  const onResizeStart = (): void => {
    const { doc } = editor
    const clip = getSelectedClip()
    if (!clip) return

    editor.playback.pause()
    resize.docDuration.value = doc.duration

    const { prev, next } = clip
    resize.clips = [prev, clip, next]

    prev?._startEditing(['duration', 'sourceStart'])
    ;[clip, next].forEach((c) => c?._startEditing(['duration', 'sourceStart', 'gap']))

    resize.isResizing.value = true
  }

  const onResizeMove = ({ rect, edges }: ResizeEvent): void => {
    const clip = getSelectedClip()
    if (!clip) return

    const { frameRate } = editor.doc
    const { prev, next, duration } = clip
    const newStart = Rational.fromDecimal(editor.pixelsToSeconds(rect.left), frameRate)
    const newDuration = Rational.fromDecimal(editor.pixelsToSeconds(rect.width), frameRate)
    const delta = newDuration.subtract(duration)

    if (edges?.left === true) clip.sourceStart = clip.sourceStart.subtract(delta)

    clip.duration = newDuration

    if (edges?.right === true) ensureDurationIsPlayable(clip)

    if (GAPPED) {
      if (edges?.left === true) clip.gap = clip.gap.subtract(delta)
      else if (next) next.gap = next.gap.subtract(delta)
    } else if (prev) prev.duration = newStart.subtract(Rational.fromDecimal(prev.time.start, frameRate))
  }

  const onResizeEnd = (): void => {
    const isResizing = resize.isResizing.value
    if (!isResizing) return

    resize.isResizing.value = false
    resize.docDuration.value = 0
    const { clips } = resize

    editor._transact(() => clips.forEach((clip) => clip?._applyEdits()))
    ;(clips as unknown[]).length = 0
  }

  effect((onCleanup) => {
    const context = editor._timelineContainer.value
    if (!context) return

    const interactable = interact('[data-clip-id]', {
      context,
      getRect(element) {
        const clip = getSelectedClip()
        if (!clip) return { left: 0, right: 0, top: 0, bottom: 0 }

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
              const clip = getSelectedClip()
              if (!clip) return { left: 0, right: 0, top: 0, bottom: 0 }

              const { time, prev } = clip
              const mediaDuration = clip.asset?.duration
              const minStartTime = Math.max(
                mediaDuration == null ? 0 : time.end - mediaDuration,
                GAPPED
                  ? (prev?.time.end ?? 0)
                  : Math.max(0, prev ? prev.time.start + 1 / clip.doc.frameRate : 0),
              )
              const maxEndTime = Math.min(
                mediaDuration == null ? Infinity : time.start + mediaDuration,
                GAPPED ? (clip.next?.time.start ?? Infinity) : Infinity,
              )

              return {
                left: editor.secondsToPixels(minStartTime),
                right: editor.secondsToPixels(maxEndTime),
                top: 0,
                bottom: 0,
              }
            },
            inner: () => {
              const clip = getSelectedClip()
              if (!clip) return { left: 0, right: 0, top: 0, bottom: 0 }

              const { time } = clip
              const minDuration = 1 / clip.doc.frameRate

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
          start: onResizeStart,
          move: onResizeMove,
          end: onResizeEnd,
        },
      },
      drag: {
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: () => ({
              left: 0,
              right: Infinity,
              top: -Infinity,
              bottom: Infinity,
            }),
          }),
        ],
        listeners: {
          start(event: DragEvent): void {
            const clip = getSelectedClip()

            if (clip) editor.drag.start(clip)
            else event.interaction.end()
          },
          move({ rect }: DragEvent): void {
            editor.drag.newStart = Rational.fromDecimal(
              editor.pixelsToSeconds(rect.left),
              editor.doc.frameRate,
            )
          },
          end(): void {
            editor.drag.end(editor)
          },
        },
      },
    })

    onCleanup(() => {
      interactable.unset()
      editor.drag.end(editor)
      onResizeEnd()
    })
  })

  return { resize }
}
