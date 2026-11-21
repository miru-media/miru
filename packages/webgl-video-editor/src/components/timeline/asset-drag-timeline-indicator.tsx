import styles from '#index.module.css'

import { useEditor } from '../utils.ts'

export const AssetDragTimelineIndicator = () => {
  const editor = useEditor()
  const { assetDrag } = editor

  return (
    <>
      {() =>
        assetDrag.asset &&
        assetDrag.target && (
          <div
            class={[styles.assetDragCursor, styles.invalid]}
            style={() => {
              const { dragOffset } = assetDrag
              return `--asset-drag-x: ${dragOffset.x}px; --asset-drag-y: ${dragOffset.y}px`
            }}
          />
        )
      }
    </>
  )
}
