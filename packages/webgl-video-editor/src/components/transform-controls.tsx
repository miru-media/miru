import '@interactjs/auto-start'
import '@interactjs/modifiers'

import type { DragEvent } from '@interactjs/actions/drag/plugin'
import type { GestureEvent } from '@interactjs/actions/gesture/plugin'
import type { ResizeEvent } from '@interactjs/actions/resize/plugin'
import interact from '@interactjs/interact'
import { computed, effect, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type * as pub from '#core'
import type { Schema } from '#core'
import { rotate } from 'shared/utils/index.ts'

import styles from '../css/index.module.css'
import type { EditView } from '../document-views/edit/edit-nodes.ts'

import { useEditor } from './utils.ts'

const ROTATE_ZERO_SNAP_DEG = 10
const TEXT_RESIZE_HANDLE_HEIGHT_DESKTOP_PX = 12
const MIN_SCALE = 0.001

interface Point {
  x: number
  y: number
}

export const TransformControls = () => {
  const editor = useEditor()
  const svgElement = ref<SVGSVGElement>()

  const selectedTransformableClip = computed<EditView.AnyVideoClip | undefined>(() => {
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
    let startScale = { x: 1, y: 1 }
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
      startScale = { x: clip.scaleX, y: clip.scaleY }
      startAngle = (clip.rotate - ('angle' in event ? event.angle : 0) + 360) % 360
      hasSnappedAngle = false
      lastSnapAngle = -1
    }

    const onEnd = () => {
      if (!isInteracting) return
      clip._applyEdits()
      isInteracting = false
    }

    const setScale = (clip: pub.AnyVideoClip, scaleX: number, scaleY: number): void => {
      const equalScaleAxes = clip.scaleX === clip.scaleY
      clip.scaleX = scaleX
      clip.scaleY = equalScaleAxes ? scaleX : scaleY
    }

    const interactable = interact(element, {
      unique: true,
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
            setScale(clip, startScale.x * event.scale, startScale.x * event.scale)

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

    const resizeStart = {
      offset: { x: 0, y: 0 },
      textInlineSize: 0,
      horizontal: false,
      vertical: true,
    }
    const getOffsetToClipCenter = (point: Point): Point => {
      const { canvasZoom, doc } = editor
      const res = doc.resolution
      return rotate(
        {
          x: point.x / canvasZoom - (clip.translateX + res.width / 2),
          y: point.y / canvasZoom - (clip.translateY + res.height / 2),
        },
        -startAngle,
      )
    }

    const RESIZE_CURSORS = ['ew', 'nwse', 'ns', 'nesw', 'ew', 'nwse', 'ns', 'nesw']

    interactable.resizable({
      origin: svgElement.value,
      cursorChecker(action) {
        /* eslint-disable @typescript-eslint/no-magic-numbers -- 45 degree increments and cursur indices */
        const edges = action.edges as Record<keyof NonNullable<typeof action.edges>, boolean> | undefined
        if (!edges) return ''

        const { top, bottom } = edges
        let i = Math.round(clip.rotate / 45)
        const n = RESIZE_CURSORS.length

        if (edges.left) i += top ? 1 : bottom ? -1 : 0
        else if (edges.right) i += 4 + (top ? -1 : bottom ? 1 : 0)
        else i += top ? 2 : bottom ? 6 : 0

        return `${RESIZE_CURSORS[(i + n) % n]}-resize`
        /* eslint-enable @typescript-eslint/no-magic-numbers */
      },
      edges: {
        left: '[data-edges~=left]',
        right: '[data-edges~=right]',
        top: '[data-edges~=top]',
        bottom: '[data-edges~=bottom]',
      },
      listeners: {
        start(event: ResizeEvent) {
          onStart(event)
          const edges = event.edges as Record<string, boolean>

          resizeStart.horizontal = edges.left || edges.right
          resizeStart.vertical = edges.top || edges.bottom
          resizeStart.offset = getOffsetToClipCenter(event.page)

          if (clip.isTextClip()) resizeStart.textInlineSize = clip.inlineSize
        },
        move(event: ResizeEvent) {
          const startOffset = resizeStart.offset
          const { horizontal, vertical } = resizeStart
          const offset = getOffsetToClipCenter(event.page)

          const scaleX = Math.max(horizontal ? offset.x / startOffset.x : 1, MIN_SCALE)
          const scaleY = Math.max(vertical ? offset.y / startOffset.y : 1, MIN_SCALE)

          if (clip.isTextClip()) {
            clip.inlineSize = Math.max(resizeStart.textInlineSize * scaleX, 1)
          } else if (clip.scaleX === clip.scaleY) {
            clip.scaleX = clip.scaleY =
              startScale.x *
              (Math.abs(horizontal ? scaleX : 0) > Math.abs(vertical ? scaleY : 0) ? scaleX : scaleY)
          } else {
            clip.scaleX = startScale.x * scaleX
            clip.scaleY = startScale.y * scaleY
          }
        },
        end: onEnd,
      },
    })

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
        [width, height, ['bottom', 'right']],
        [0, height, ['left', 'bottom']],
        [0, 0, ['top', 'left']],
        [width, 0, ['right', 'top']],
      ] as const
    ).map(([x, y, edges]) => ({ point: matrix.apply(new Pixi.Point(x, y)), edges }))
  })

  const textResizeHandles = computed(() => {
    const clip = selectedTransformableClip.value
    if (!clip) return

    const { width, height } = clipSize.value
    const matrix = clipBoxMatrix.value
    const halfHeight = height / 2
    const halfHandleHeight = TEXT_RESIZE_HANDLE_HEIGHT_DESKTOP_PX / (2 * clip.scaleY * editor.canvasZoom)

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
    <svg ref={svgElement} class={styles.transformControls}>
      {() => {
        const clip = selectedTransformableClip.value
        if (!clip?.isInClipTime) return

        const points = boxPoints.value
        const edges: [p1: Pixi.Point, p2: Pixi.Point, edge: string][] = []

        if (!clip.isTextClip())
          for (let i = 0; i < points.length; i++) {
            const start = points[i]
            const end = points[(i + 1) % points.length]
            edges.push([start.point, end.point, start.edges[0]])
          }

        return (
          <>
            <polygon points={points.map(({ point: { x, y } }) => `${x} ${y}`)} class={styles.transformBox} />

            {() =>
              clip.isTextClip() ? (
                textResizeHandles.value?.map(({ a, b, edge }) =>
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
                )
              ) : (
                <>
                  {edges.map(([a, b, edge]) => (
                    <g>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        class={styles.transformEdges}
                        data-edges={edge}
                      />
                    </g>
                  ))}
                  {boxPoints.value.map(({ point: { x, y }, edges }) => (
                    <rect
                      x={x}
                      y={y}
                      data-edges={edges.join(' ')}
                      class={styles.transformResizeCorner}
                      style={`rotate: ${clip.rotate}deg; transform-origin: ${x}px ${y}px`}
                    />
                  ))}
                </>
              )
            }
          </>
        )
      }}
    </svg>
  )
}
