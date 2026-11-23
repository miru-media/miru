import styles from '#index.module.css'

import { useEditor } from './utils.ts'

export const AssetDragCursor = () => {
  const editor = useEditor()
  const { assetDrag } = editor

  return (
    <>
      {() => {
        const { asset } = assetDrag
        if (!asset) return undefined

        return (
          <div
            class={[styles.assetDragCursor, styles.invalid]}
            style={() => {
              const { dragCoords } = assetDrag
              return `--asset-drag-x: ${dragCoords.x}px; --asset-drag-y: ${dragCoords.y}px`
            }}
          >
            {asset.thumbnailUri ? (
              <img src={asset.thumbnailUri} alt="" class={styles.assetDragThumbnail} />
            ) : asset.isAudio() ? (
              <IconMsMusicNoteRounded class={styles.assetDragThumbnail} />
            ) : (
              <IconMsPhotoOutlineRounded class={styles.assetDragThumbnail} />
            )}
          </div>
        )
      }}
    </>
  )
}
