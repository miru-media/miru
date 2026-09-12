import type * as pub from '#core'

import styles from '../css/index.module.css'

import { Clip } from './clip.jsx'
import { nodesAreLinked, useEditor } from './utils.js'

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
      class={() => [styles.track, editor.getTrackForMedia({ video: true }).id === track.id && styles.primary]}
      style={() => `--track-width: ${editor.secondsToPixels(track.duration.valueOf())}px;`}
    >
      {() =>
        track.children.map((node) => {
          const isSelected = () => {
            const { selection } = editor
            return !!(selection?.isNode && nodesAreLinked(node, selection))
          }

          return <Clip {...{ editor, node, isSelected }} />
        })
      }
    </div>
  )
}
