import '@interactjs/auto-start'
import '@interactjs/modifiers'

import type { DragEvent } from '@interactjs/actions/drag/plugin'
import interact from '@interactjs/interact'
import { computed, effect, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type { TransformProps } from '#schema'

import styles from '../css/index.module.css'
import type { EditView } from '../document-views/edit/edit-nodes.ts'

import { useEditor } from './utils.ts'

export const TransformControls = () => {
  const editor = useEditor()
  const container = ref<SVGElement>()

  const getSelectedClip = (): EditView.VideoClip | EditView.TextClip | undefined => {
    const { selection } = editor
    if (selection?.isNode && selection.isVideo() && selection.isClip()) return selection
  }
  const clipSize = computed(() => {
    const renderClip = editor.playback.renderView._getNode(getSelectedClip())
    return renderClip?.getSize() ?? { width: 0, height: 0 }
  })

  const clipProps = computed(
    (): TransformProps =>
      getSelectedClip() ?? { translate: { x: 0, y: 0 }, rotate: 0, scale: { x: 1, y: 1 } },
  )

  effect((onCleanup) => {
    const element = container.value
    if (!element) return

    const dragger = interact(element, {
      getRect() {
        const clip = clipProps.value

        const { x, y } = clip.translate
        const { width, height } = clipSize.value
        return { left: x, top: y, right: x + width, bottom: y + height }
      },
    }).draggable({
      listeners: {
        start() {
          getSelectedClip()?._startEditing(['translate', 'scale'])
        },
        move(event: DragEvent) {
          const clip = clipProps.value

          const { zoom } = editor
          const { translate } = clip
          const { delta } = event
          clip.translate = { x: translate.x + delta.x / zoom, y: translate.y + delta.y / zoom }
        },
        end() {
          getSelectedClip()?._applyEdits()
        },
      },
    })

    onCleanup(() => {
      dragger.unset()
    })
  })

  const clipMatrix = computed(
    () =>
      editor.playback.renderView
        ._getNode(getSelectedClip())
        ?.matrix.value.clone()
        .scale(editor.zoom, editor.zoom) ?? new Pixi.Matrix(),
  )

  const boxPoints = computed(() => {
    const { width, height } = clipSize.value

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

  return (
    <svg class={styles.transformControls}>
      <g ref={container}>
        {() => {
          const clip = getSelectedClip()
          if (!clip?.isVideo() || !clip.isInClipTime) return

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
            </>
          )
        }}
      </g>
    </svg>
  )
}
