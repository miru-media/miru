import type { DragEvent } from '@interactjs/actions/drag/plugin.js'
import type { ResizeEvent } from '@interactjs/actions/resize/plugin.js'
import interact from '@interactjs/interact'
import { effect } from 'fine-jsx'

import { Rational } from 'shared/utils/math.ts'

import styles from '../../css/index.module.css'
import type { EditView } from '../../document-views/edit/edit-nodes.ts'
import type { VideoEditor } from '../../video-editor.ts'

const enum ClipPos {
  Prev = 0,
  Cur = 1,
  Next = 2,
}

export const useClipDragResize = (editor: VideoEditor): void => {
  const resize = editor._editor.doc.clipResize

  const getSelectedClip = (): EditView.AnyClip | undefined => {
    const { selection, doc } = editor._editor
    if (selection?.isNode && selection.isClip()) return doc._getNode(selection)
  }

  const onResizeStart = (): void => {
    const clip = getSelectedClip()
    if (!clip) return

    editor.playback.pause()
    resize.start(clip)

    resize.linkedClips.forEach(([prev, cur, next]) => {
      prev?._startEditing(['duration', 'sourceStart'])
      ;[cur, next].forEach((c) => c?._startEditing(['duration', 'sourceStart', 'gap']))
    })
  }

  const onResizeMove = ({ rect, edges }: ResizeEvent): void => {
    resize.move(
      editor.pixelsToSeconds(rect.left),
      editor.pixelsToSeconds(rect.width),
      edges as { left: boolean; right: boolean },
    )
  }

  const onResizeEnd = (): void => {
    editor._editor._transact(() => resize.end())
  }

  effect((onCleanup) => {
    const context = editor._timelineContainer.value
    if (!context) return

    const interactable = interact('[data-interactive-clip-id]', {
      context,
      getRect(element) {
        const clip = resize.isActive() ? resize.clips[ClipPos.Cur] : getSelectedClip()
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
              const { start, end } = resize.getOuterLimit()

              return {
                left: editor.secondsToPixels(start),
                right: editor.secondsToPixels(end),
                top: -Infinity,
                bottom: Infinity,
              }
            },
            inner: () => {
              const { start, end } = resize.getInnerLimit()

              return {
                left: editor.secondsToPixels(start),
                right: editor.secondsToPixels(end),
                top: Infinity,
                bottom: -Infinity,
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

            if (clip) {
              editor.drag.start(clip) || event.interaction.end()
            } else event.interaction.end()
          },
          move({ rect, pageY, y0 }: DragEvent): void {
            editor.drag.newStart = Rational.fromDecimal(
              editor.pixelsToSeconds(rect.left),
              editor.doc.frameRate,
            )
            editor.drag._offsetY.value = pageY - y0
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
}
