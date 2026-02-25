import '@interactjs/auto-start'
import '@interactjs/modifiers'

import type { DragEvent } from '@interactjs/actions/drag/plugin'
import type { ResizeEvent } from '@interactjs/actions/resize/plugin'
import interact from '@interactjs/interact'
import { computed, effect, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import styles from '../css/index.module.css'
import type { VisualClip } from '../nodes/visual-clip.ts'
import { getClipTransformMatrix } from '../utils.ts'
import type { VideoEditor } from '../video-editor.ts'

const ROTATE_LINE_LENGTH = 50

export const TransformControls = ({ editor }: { editor: VideoEditor }) => {
  const container = ref<SVGElement>()
  const clipProps = computed((): Pick<VisualClip, 'position' | 'rotation' | 'scale' | 'mediaSize'> => {
    const clip = editor.selection
    if (!clip?.isVisual())
      return {
        position: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        mediaSize: { width: 0, height: 0 },
      }

    return clip
  })
  const rotateZoomMatrix = computed(() => {
    const { zoom } = editor
    const { mediaSize, rotation } = clipProps.value
    const halfWidth = mediaSize.width / 2
    const halfHeight = mediaSize.height / 2

    return new Pixi.Matrix()
      .translate(-halfWidth, -halfHeight)
      .rotate((rotation * Math.PI) / 180)
      .translate(halfWidth, halfHeight)
      .scale(zoom, zoom)
  })

  effect((onCleanup) => {
    const element = container.value
    if (!element) return

    const dragger = interact(element, {
      getRect() {
        const clip = clipProps.value

        const { x, y } = clip.position
        const { width, height } = clip.mediaSize
        return { left: x, top: y, right: x + width, bottom: y + height }
      },
    }).draggable({
      listeners: {
        move(event: DragEvent) {
          const clip = clipProps.value

          const { zoom } = editor
          const { position } = clip
          const { delta } = event
          clip.position = { x: position.x + delta.x / zoom, y: position.y + delta.y / zoom }
        },
      },
    })

    let edges: Record<string, boolean | undefined> = {}
    const resizeStart = {
      pointer: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
    }

    const resizer = interact('[data-edges]', { context: element }).draggable({
      origin: element,
      listeners: {
        start(event: ResizeEvent) {
          const clip = editor.selection
          if (!clip?.isVisual()) return
          resizeStart.pointer = rotateZoomMatrix.value.applyInverse(new Pixi.Point(event.pageX, event.pageY))
          resizeStart.position = clip.position
          const { scale, mediaSize } = clip
          resizeStart.size = { width: mediaSize.width * scale.x, height: mediaSize.height * scale.y }
          edges = Object.fromEntries(
            (event.target.dataset.edges ?? '').split(' ').map((edge) => [edge, true]),
          )
        },
        move(event: ResizeEvent) {
          const clip = clipProps.value

          const { mediaSize } = clip
          const startSize = resizeStart.size
          const pointer = rotateZoomMatrix.value.applyInverse(new Pixi.Point(event.pageX, event.pageY))
          const dx = (pointer.x - resizeStart.pointer.x) * (edges.left ? -1 : edges.right ? 1 : 0)
          const dy = (pointer.y - resizeStart.pointer.y) * (edges.top ? -1 : edges.bottom ? 1 : 0)
          const newSize = {
            width: Math.max(startSize.width + dx, 1),
            height: Math.max(startSize.height + dy, 1),
          }
          const newScale = { x: newSize.width / mediaSize.width, y: newSize.height / mediaSize.height }

          if (Math.abs(dx) > Math.abs(dy)) newScale.y = newScale.x
          else newScale.x = newScale.y

          clip.scale = newScale
        },
      },
    })

    onCleanup(() => {
      dragger.unset()
      resizer.unset()
    })
  })

  const clipMatrix = computed(() =>
    (editor.selection?.isVisual()
      ? getClipTransformMatrix(editor.selection, false)
      : new Pixi.Matrix()
    ).scale(editor.zoom, editor.zoom),
  )

  const boxPoints = computed(() => {
    const { width, height } = clipProps.value.mediaSize

    const matrix = clipMatrix.value
    return (
      [
        [width, height, ['bottom', 'right']],
        [0, height, ['left', 'bottom']],
        [0, 0, ['top', 'left']],
        [width, 0, ['right', 'top']],
      ] as const
    ).map(([x, y, edges]) => ({ point: matrix.apply(new Pixi.Point(x, y)), edges }))
  })

  const rotateLine = computed(() => {
    const halfWidth = clipProps.value.mediaSize.width / 2
    const matrix = clipMatrix.value
    const clipScale = editor.selection?.isVisual() ? editor.selection.scale : { x: 1, y: 1 }
    const { zoom } = editor

    return {
      start: matrix.apply(new Pixi.Point(halfWidth, 0)),
      end: matrix.apply(new Pixi.Point(halfWidth, -ROTATE_LINE_LENGTH / zoom / clipScale.y)),
    }
  })

  return (
    <svg class={styles.transformControls}>
      {() => {
        const clip = editor.selection
        if (!clip?.isVisual() || !clip.isInClipTime) return

        return (
          <g ref={container}>
            {() => {
              const { start: rotateStart, end: rotateEnd } = rotateLine.value
              const points = boxPoints.value
              const edges: [p1: Pixi.Point, p2: Pixi.Point, edge: string][] = []

              for (let i = 0; i < points.length; i++) {
                const start = points[i]
                const end = points[(i + 1) % points.length]
                edges.push([start.point, end.point, start.edges[0]])
              }

              return (
                <>
                  <polygon
                    points={points.map(({ point: p }) => `${p.x},${p.y}`).join(' ')}
                    class={styles.transformDrag}
                  />
                  {edges.map(([a, b, edge]) => (
                    <g>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class={styles.transformBox} />
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
                    <circle cx={x} cy={y} class={styles.transformResizeCorner} data-edges={edges.join(' ')} />
                  ))}
                  <line
                    x1={rotateStart.x}
                    x2={rotateEnd.x}
                    y1={rotateStart.y}
                    y2={rotateEnd.y}
                    class={styles.transformRotateLine}
                  />
                  <circle cx={rotateEnd.x} cy={rotateEnd.y} class={styles.transformRotateHandle} />
                </>
              )
            }}
          </g>
        )
      }}
    </svg>
  )
}
