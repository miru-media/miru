import type * as pub from '#core'
import styles from '#index.module.css'

import { useEditor } from '../utils.js'

import { AssetDragClipIndicator } from './asset-drag-clip-indicator.jsx'
import { Clip } from './clip.jsx'

export const Track = ({
  track,
  ...props
}: {
  track: pub.AnyTrack
  [index: string]: unknown
}): JSX.Element => {
  const editor = useEditor()

  return (
    <div
      {...props}
      class={() => [
        styles.track,
        editor.getTrackForMedia({ video: true })?.id === track.id && styles.primary,
      ]}
      style={() => `--track-width: ${editor.secondsToPixels(track.duration.valueOf())}px;`}
    >
      <>
        {() => [
          ...track.children.map((node) => {
            const isSelected = (): boolean => editor.selection.linkedNodeIds.has(node.id)

            return <Clip {...{ editor, node, isSelected }} />
          }),
        ]}
      </>
      <>
        {() => {
          const { target } = editor.assetDrag
          return target?.before === false && target.trackId === track.id && <AssetDragClipIndicator />
        }}
      </>
    </div>
  )
}
