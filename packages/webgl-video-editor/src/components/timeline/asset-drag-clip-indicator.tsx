import styles from '#index.module.css'

import { useClipEdges, useEditor } from '../utils.ts'

export const AssetDragClipIndicator = () => {
  const editor = useEditor()
  const boxEdges = useClipEdges(editor, {
    get time() {
      const { target } = editor.assetDrag
      if (!target) return { start: 0, duration: 0, end: 0, source: 0 }
      const { time, duration } = target
      return { start: time, duration, end: time + duration, source: 0 }
    },
  })
  return (
    <div
      class={styles.assetDragClipIndicator}
      style={() => {
        const { left, right } = boxEdges.value
        return `--clip-box-left:${left}px;--clip-box-right:${right}px`
      }}
    />
  )
}
