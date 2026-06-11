import type * as pub from '#core'

import styles from '../css/index.module.css'

import { Clip } from './clip.jsx'
import { useEditor } from './utils.js'

export const Track = ({ track, ...props }: { track: pub.Track; [index: string]: unknown }): JSX.Element => {
  const editor = useEditor()

  return (
    <div
      {...props}
      class={() => [styles.track, editor.getTrackForMedia({ video: true }).id === track.id && styles.primary]}
      data-track-type={track.trackType}
      style={() => `--track-width: ${editor.secondsToPixels(track.duration.valueOf())}px;`}
    >
      {() =>
        track.children.map((node) => {
          const isSelected = () => !!editor.selection?.isNode && editor.selection.id === node.id

          return <Clip {...{ editor, node, isSelected }} />
        })
      }
    </div>
  )
}
