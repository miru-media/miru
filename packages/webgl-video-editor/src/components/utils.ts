import type { DragEvent } from '@interactjs/actions/drag/plugin.js'
import type { ResizeEvent } from '@interactjs/actions/resize/plugin.js'
import interact from '@interactjs/interact'
import { effect, ref } from 'fine-jsx'
import { inject, provide } from 'fine-jsx/jsx-runtime'

import type { AnyClip } from '#core'
import type { ClipDrag, ClipResize } from '#internal'
import { Rational } from 'shared/utils/math.ts'

import styles from '../css/index.module.css'
import type { VideoEditor } from '../video-editor.ts'

const VIDEO_EDITOR_CONTEXT = Symbol('video-editor-context')

export const useEditor = (): VideoEditor => inject<VideoEditor>(VIDEO_EDITOR_CONTEXT)!
export const provideEditor = (editor: VideoEditor): void => provide(VIDEO_EDITOR_CONTEXT, editor)

export const useClipDragResize = (editor: VideoEditor): { drag: ClipDrag; resize: ClipResize } => {
  const drag: ClipDrag = {
    isDragging: ref(false),
    x: ref(0),
    targetTrack: ref<{ id: string; before: boolean }>(),
  }

  const resize: ClipResize = {
    docDuration: ref(0),
    isResizing: ref(false),
    clips: undefined,
  }

  const getClip = (): AnyClip | undefined => {
    const { selection } = editor
    if (selection?.isClip()) return selection
  }

  const onDragStart = ({ rect }: DragEvent): void => {
    drag.isDragging.value = true
    drag.x.value = rect.left
  }

  const onDragMove = ({ rect }: DragEvent): void => {
    editor._transact(() => {
      const clip = getClip()
      if (!clip?.parent) return

      editor.drag.x.value = rect.left

      const { parent } = clip
      const newStartTime = editor.pixelsToSeconds(rect.left)
      const newCenterTime = newStartTime + clip.time.duration / 2

      let insertBefore: AnyClip | undefined
      for (let { prevClip } = clip; prevClip; { prevClip } = prevClip) {
        const { start, duration } = prevClip.time
        if (start >= newStartTime || start + duration / 2 >= newCenterTime) insertBefore = prevClip
        else break
      }

      if (insertBefore) {
        clip.move({ parentId: parent.id, index: insertBefore.index })
        return
      }

      const newEndTime = newStartTime + clip.time.duration

      let insertAfter: AnyClip | undefined
      for (let { nextClip } = clip; nextClip; { nextClip } = nextClip) {
        const { end, duration } = nextClip.time
        if (end <= newEndTime || end - duration / 2 <= newCenterTime) insertAfter = nextClip
        else break
      }
      if (insertAfter) {
        clip.move({ parentId: parent.id, index: insertAfter.index + 1 })
      }
    })
  }

  const onDragEnd = (): void => {
    const { isDragging, x, targetTrack } = drag
    isDragging.value = false
    targetTrack.value = undefined

    x.value = 0
  }

  const onResizeStart = (): void => {
    const clip = editor.doc._getNode(getClip())
    if (!clip) return

    editor.playback.pause()

    editor.doc._getNode(clip)
    resize.docDuration.value = editor.doc.duration

    const { prev, next } = clip as unknown as Record<string, NonNullable<typeof resize.clips>[number]>
    resize.clips = [prev, clip, next]
    resize.clips.forEach((clip) => clip?._startEditing(['duration', 'sourceStart']))

    resize.isResizing.value = true
  }
  const onResizeMove = ({ rect, edges }: ResizeEvent): void => {
    editor._transact(() => {
      const clip = getClip()
      if (!clip) return

      const docFrameRate = editor.doc.frameRate
      const { prev, duration } = clip
      const newStart = Rational.fromDecimal(editor.pixelsToSeconds(rect.left), docFrameRate)
      const newDuration = Rational.fromDecimal(editor.pixelsToSeconds(rect.width), docFrameRate).toRate(
        duration.rate,
      )

      if (edges?.left === true) {
        const delta = newDuration.subtract(duration)
        clip.sourceStart = clip.sourceStart.subtract(delta)
      }

      clip.duration = newDuration

      if (edges?.right === true) ensureDurationIsPlayable(clip)

      if (prev) prev.duration = newStart.subtract(Rational.fromDecimal(prev.time.start, docFrameRate))
    })
  }

  const onResizeEnd = (): void => {
    const isResizing = resize.isResizing.value
    if (!isResizing) return

    resize.isResizing.value = false
    resize.docDuration.value = 0
    const { clips } = resize

    if (clips) {
      clips.forEach((clip) => clip?._applyEdits())
      ;(clips as unknown[]).length = 0
      resize.clips = undefined
    }
  }

  effect((onCleanup) => {
    const context = editor._timelineContainer.value
    if (!context) return

    const interactable = interact('[data-clip-id]', {
      context,
      getRect(element) {
        const clip = getClip()
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
              const clip = getClip()
              if (!clip) return { left: 0, right: 0, top: 0, bottom: 0 }

              const { time, prev } = clip
              const mediaDuration = clip.asset?.duration
              const minStartTime = Math.max(
                mediaDuration == null ? 0 : time.end - mediaDuration,
                Math.max(0, prev ? prev.time.start + 1 / clip.doc.frameRate : 0),
              )
              const maxEndTime = mediaDuration == null ? Infinity : time.start + mediaDuration

              return {
                left: editor.secondsToPixels(minStartTime),
                right: editor.secondsToPixels(maxEndTime),
                top: 0,
                bottom: 0,
              }
            },
            inner: () => {
              const clip = getClip()
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
              right: editor.secondsToPixels(editor.doc.duration),
              top: -Infinity,
              bottom: Infinity,
            }),
          }),
        ],
        listeners: {
          start: onDragStart,
          move: onDragMove,
          end: onDragEnd,
        },
      },
    })

    onCleanup(() => {
      interactable.unset()
      onDragEnd()
      onResizeEnd()
    })
  })

  return { drag, resize }
}

const ensureDurationIsPlayable = (clip: AnyClip): void => {
  const { asset } = clip
  if (!asset) return

  const docFrameRate = clip.doc.frameRate
  const sourceDuration = Rational.fromDecimal(asset.duration, docFrameRate)
  const durationOutsideClip = sourceDuration.subtract(clip.sourceStart.add(clip.duration))
  const { sourceStart } = clip
  clip.sourceStart = sourceStart.add(durationOutsideClip)

  clip.duration = Rational.min(clip.duration, sourceDuration)
}
