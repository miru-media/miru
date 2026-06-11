import '@interactjs/actions/drop'
import type { DropEvent } from '@interactjs/actions/drop/DropEvent'
import interact from '@interactjs/interact'
import { effect } from 'fine-jsx'

import type * as pub from '#core'

import type { VideoEditor } from '../../video-editor.ts'

export const useTrackDropzone = (editor: VideoEditor) => {
  effect((onCleanup) => {
    const container = editor._timelineContainer.value
    if (!container) return

    interact.dynamicDrop(true)

    const dropzone = interact('[data-track-id], [data-before-track-id]', {
      context: container,
      getRect(element) {
        const left = 0
        const right = editor._timelineSize.value.width
        const { top, bottom } = element.getBoundingClientRect()

        return { left, right, top, bottom }
      },
    })
      .dropzone({
        accept: '[data-clip-id]',
        overlap: 'pointer',
      })
      .on({
        dragenter(event: DropEvent) {
          const { clipDrag } = editor.doc
          if (!clipDrag.isDragging()) return

          const { trackId, beforeTrackId } = event.target.dataset
          const id = trackId ?? beforeTrackId ?? ''
          const track = id ? editor.doc.nodes.get<pub.Track>(id) : undefined

          if (!track) return

          if (trackId && clipDrag.trackType === track.trackType) {
            clipDrag.targetTrack = { id: trackId, before: false }
          } else if (beforeTrackId) {
            const clipParentId = clipDrag.clip.parent?.id

            if (
              !track.head ||
              (track.prev !== undefined && !track.prev.head) ||
              ((track.id === clipParentId || track.prev?.id === clipParentId) && clipDrag.clipWasAloneInTrack)
            ) {
              if (track.trackType === clipDrag.trackType)
                clipDrag.targetTrack = { id: beforeTrackId, before: false }
            } else clipDrag.targetTrack = { id: beforeTrackId, before: true }
          }
        },
        dragleave() {
          const { clipDrag } = editor.doc
          if (!clipDrag.isDragging()) return
          clipDrag.targetTrack = { id: clipDrag.parent.id, before: false }
        },
      })

    onCleanup(dropzone.unset.bind(dropzone))
  })
}
