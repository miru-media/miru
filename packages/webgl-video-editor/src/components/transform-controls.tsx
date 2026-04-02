import '@interactjs/auto-start'
import '@interactjs/modifiers'

import type { DragEvent } from '@interactjs/actions/drag/plugin'
import type { ResizeEvent } from '@interactjs/actions/resize/plugin'
import interact from '@interactjs/interact'
import { computed, effect, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type { VideoClip } from '#core'

import styles from '../css/index.module.css'
import { getClipTransformMatrix } from '../utils.ts'

import { useEditor } from './utils.ts'

const ROTATE_LINE_LENGTH = 50

export const TransformControls = () => {
  const editor = useEditor()
  const container = ref<SVGElement>()

  const clipMediaSize = computed(() => {
    const clip = editor.selection
    return clip?.isVideo() && clip.asset?.video ? clip.asset.video : { width: 0, height: 0 }
  })
  const clipProps = computed((): Pick<VideoClip, 'translate' | 'rotate' | 'scale'> => {
    const clip = editor.selection
    return clip?.isVideo() ? clip : { translate: { x: 0, y: 0 }, rotate: 0, scale: { x: 1, y: 1 } }
  })

  const rotateZoomMatrix = computed(() => {
    const { zoom } = editor
    const { rotate } = clipProps.value
    const mediaSize = clipMediaSize.value
    const halfWidth = mediaSize.width / 2
    const halfHeight = mediaSize.height / 2

    return new Pixi.Matrix()
      .translate(-halfWidth, -halfHeight)
      .rotate((rotate * Math.PI) / 180)
      .translate(halfWidth, halfHeight)
      .scale(zoom, zoom)
  })

  effect((onCleanup) => {
    const element = container.value
    if (!element) return

    const dragger = interact(element, {
      getRect() {
        const clip = clipProps.value

        const { x, y } = clip.translate
        const { width, height } = clipMediaSize.value
        return { left: x, top: y, right: x + width, bottom: y + height }
      },
    }).draggable({
      listeners: {
        start() {
          if (!editor.selection?.isVideo()) return
          editor.selection._startEditing(['translate', 'scale'])
        },
        move(event: DragEvent) {
          const clip = clipProps.value

          const { zoom } = editor
          const { translate } = clip
          const { delta } = event
          clip.translate = { x: translate.x + delta.x / zoom, y: translate.y + delta.y / zoom }
        },
        end() {
          editor.selection?._applyEdits()
        },
      },
    })

    let edges: Record<string, boolean | undefined> = {}
    const resizeStart = {
      pointer: { x: 0, y: 0 },
      translate: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
    }

    const resizer = interact('[data-edges]', { context: element }).draggable({
      origin: element,
      listeners: {
        start(event: ResizeEvent) {
          const clip = editor.selection
          if (!clip?.isVideo()) return

          clip._startEditing(['translate', 'scale'])

          resizeStart.pointer = rotateZoomMatrix.value.applyInverse(new Pixi.Point(event.pageX, event.pageY))
          resizeStart.translate = clip.translate
          const { scale } = clip
          const mediaSize = clipMediaSize.value
          resizeStart.size = { width: mediaSize.width * scale.x, height: mediaSize.height * scale.y }
          edges = Object.fromEntries(
            (event.target.dataset.edges ?? '').split(' ').map((edge) => [edge, true]),
          )
        },
        move(event: ResizeEvent) {
          const clip = clipProps.value

          const mediaSize = clipMediaSize.value
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
        end() {
          editor.selection?._applyEdits()
        },
      },
    })

    onCleanup(() => {
      dragger.unset()
      resizer.unset()
    })
  })

  const clipMatrix = computed(() => {
    const clip = editor.selection
    if (!clip?.isVideo()) return new Pixi.Matrix()

    return getClipTransformMatrix(clip, false).scale(editor.zoom, editor.zoom)
  })

  const boxPoints = computed(() => {
    const { width, height } = clipMediaSize.value

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
    const halfWidth = clipMediaSize.value.width / 2
    const matrix = clipMatrix.value
    const clipScale = editor.selection?.isVideo() ? editor.selection.scale : { x: 1, y: 1 }
    const { zoom } = editor

    return {
      start: matrix.apply(new Pixi.Point(halfWidth, 0)),
      end: matrix.apply(new Pixi.Point(halfWidth, -ROTATE_LINE_LENGTH / zoom / clipScale.y)),
    }
  })

  return (
    <svg class={styles.transformControls}>
      <g ref={container}>
        {() => {
          const clip = editor.selection
          if (!clip?.isVideo() || !clip.isInClipTime || !clip.asset?.video) return

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
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class={styles.transformEdges} data-edges={edge} />
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
    </svg>
  )
}
