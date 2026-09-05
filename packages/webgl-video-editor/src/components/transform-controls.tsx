import '@interactjs/auto-start'
import '@interactjs/modifiers'

import type { DragEvent } from '@interactjs/actions/drag/plugin'
import type { GestureEvent } from '@interactjs/actions/gesture/plugin'
import type { ResizeEvent } from '@interactjs/actions/resize/plugin'
import interact from '@interactjs/interact'
import { computed, effect } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type { Schema } from '#core'

import styles from '../css/index.module.css'
import type { EditView } from '../document-views/edit/edit-nodes.ts'

import { useEditor } from './utils.ts'

const ROTATE_ZERO_SNAP_DEG = 10
const RESIZE_HANDLE_HEIGHT_DESKTOP_PX = 12

export const TransformControls = () => {
  const editor = useEditor()

  const selectedTransformableClip = computed<EditView.VideoClip | EditView.TextClip | undefined>(() => {
    const { selection } = editor
    if (selection?.isNode && selection.isVideo() && selection.isClip()) return selection
  })
  const clipSize = computed(() => {
    const renderClip = editor.playback.renderView._getNode(selectedTransformableClip.value)
    return renderClip?.getSize() ?? { width: 0, height: 0 }
  })

  const clipProps = computed(
    (): Schema.TransformProps =>
      selectedTransformableClip.value ?? {
        translateX: 0,
        translateY: 0,
        rotate: 0,
        scaleX: 1,
        scaleY: 1,
      },
  )

  effect((onCleanup) => {
    const element = editor._viewportContainer.value
    const clip = selectedTransformableClip.value
    if (!element || !clip) return

    let isInteracting = false
    let startScale = 1
    let startAngle = 0
    let hasSnappedAngle = false
    let lastSnapAngle = -1

    const onStart = (event: DragEvent | GestureEvent | ResizeEvent) => {
      isInteracting = true
      clip._startEditing([
        'translateX',
        'translateY',
        'scaleX',
        'scaleY',
        ...((clip.isTextClip() ? (['inlineSize'] satisfies (keyof Schema.TextClip)[]) : []) as never),
      ])
      startScale = clip.scaleX
      startAngle = (clip.rotate - ('angle' in event ? event.angle : 0) + 360) % 360
      hasSnappedAngle = false
      lastSnapAngle = -1
    }

    const onEnd = () => {
      if (!isInteracting) return
      clip._applyEdits()
      isInteracting = false
    }

    const interactable = interact(element, {
      getRect() {
        const { translateX, translateY } = clipProps.value
        const { width, height } = clipSize.value
        return { left: translateX, top: translateY, right: translateX + width, bottom: translateY + height }
      },
    })
      .draggable({
        listeners: {
          start: onStart,
          move(event: DragEvent) {
            const { canvasZoom } = editor
            const { delta } = event
            clip.translateX += delta.x / canvasZoom
            clip.translateY += delta.y / canvasZoom
          },
          end: onEnd,
        },
      })
      .gesturable({
        listeners: {
          start: onStart,
          move(event: GestureEvent) {
            const clip = clipProps.value

            clip.scaleX = clip.scaleY = startScale * event.scale

            let newAngle = (startAngle + event.angle + 360) % 360
            const nearest90 = Math.round(newAngle / 90) * 90

            if (lastSnapAngle !== nearest90) {
              if (Math.abs(newAngle - nearest90) <= ROTATE_ZERO_SNAP_DEG) {
                newAngle = nearest90
                hasSnappedAngle = true
              } else if (hasSnappedAngle) {
                hasSnappedAngle = false
                lastSnapAngle = nearest90
              }
            }

            clip.rotate = newAngle - (newAngle > 180 ? 360 : 0)
          },
          end: onEnd,
        },
      })

    if (clip.isTextClip()) {
      let edges: Record<string, boolean | undefined> = {}
      const textResizeStart = {
        matrix: new Pixi.Matrix(),
        pointer: { x: 0, y: 0 },
        inlineSize: 0,
      }

      interactable.resizable({
        origin: element,
        edges: { left: '[data-edges~=left]', right: '[data-edges~=right]' },
        listeners: {
          start(event: ResizeEvent) {
            onStart(event)
            const zoom = editor.canvasZoom
            const matrix = (
              editor.playback.renderView._getNode(selectedTransformableClip.value)?.matrix.value.clone() ??
              new Pixi.Matrix()
            ).scale(zoom, zoom)

            textResizeStart.matrix = matrix
            textResizeStart.pointer = matrix.applyInverse(new Pixi.Point(event.pageX, event.pageY))
            textResizeStart.inlineSize = clip.inlineSize

            edges = event.edges as Record<string, boolean>
          },
          move(event: ResizeEvent) {
            const pointer = textResizeStart.matrix.applyInverse(new Pixi.Point(event.pageX, event.pageY))
            const direction = edges.left ? -1 : edges.right ? 1 : 0

            clip.inlineSize = Math.max(
              textResizeStart.inlineSize + (pointer.x - textResizeStart.pointer.x) * direction * 2,
              1,
            )
          },
          end: onEnd,
        },
      })
    }

    onCleanup(() => {
      onEnd()
      interactable.unset()
    })
  })

  const clipBoxMatrix = computed(
    () =>
      editor.playback.renderView
        ._getNode(selectedTransformableClip.value)
        ?.matrix.value.clone()
        .scale(editor.canvasZoom, editor.canvasZoom) ?? new Pixi.Matrix(),
  )

  const boxPoints = computed(() => {
    const { width, height } = clipSize.value
    const matrix = clipBoxMatrix.value

    return (
      [
        [width, height],
        [0, height],
        [0, 0],
        [width, 0],
      ] as const
    ).map(([x, y]) => matrix.apply(new Pixi.Point(x, y)))
  })

  const resizeHandles = computed(() => {
    const clip = selectedTransformableClip.value
    if (!clip?.isTextClip()) return

    const { width, height } = clipSize.value
    const matrix = clipBoxMatrix.value
    const halfHeight = height / 2
    const halfHandleHeight = RESIZE_HANDLE_HEIGHT_DESKTOP_PX / (2 * clip.scaleY * editor.canvasZoom)

    return (
      [
        [0, halfHeight - halfHandleHeight, halfHeight + halfHandleHeight, 'left'],
        [width, halfHeight - halfHandleHeight, halfHeight + halfHandleHeight, 'right'],
      ] as const
    ).map(([x, y1, y2, edge]) => ({
      a: matrix.apply(new Pixi.Point(x, y1)),
      b: matrix.apply(new Pixi.Point(x, y2)),
      edge,
    }))
  })

  return (
    <svg class={styles.transformControls}>
      {() => {
        const clip = selectedTransformableClip.value
        if (!clip?.isVideo() || !clip.isInClipTime) return

        return (
          <>
            <polygon points={boxPoints.value.map(({ x, y }) => `${x} ${y}`)} class={styles.transformBox} />
            {resizeHandles.value?.map(({ a, b, edge }) =>
              [styles.transformResizeOutline, styles.transformResizeHandle].map((className) => (
                <line
                  // add a direct event listener so it's treated as a touch target on mobile
                  onPointerdown={() => undefined}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  class={className}
                  data-edges={edge}
                />
              )),
            )}
          </>
        )
      }}
    </svg>
  )
}
