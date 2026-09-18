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
        const right = editor.secondsToPixels(editor.doc.duration)
        const { top, bottom } = element.getBoundingClientRect()

        return { left, right, top, bottom }
      },
    })
      .dropzone({
        accept: '[data-interactive-clip-id]',
        overlap: 'pointer',
      })
      .on({
        dragenter(event: DropEvent) {
          const { clipDrag } = editor.doc
          if (!clipDrag.isActive()) return

          const { trackId, beforeTrackId, end } = event.target.dataset
          const id = trackId ?? beforeTrackId ?? ''
          const track = id ? editor.doc.nodes.get<pub.AnyTrack>(id) : undefined
          const unchanged = { id: clipDrag.parent.id, before: false }

          if (end !== undefined) {
            clipDrag.targetTrack =
              clipDrag.clipWasAloneInTrack && clipDrag.parent.id === editor.doc.timeline.tail?.id
                ? unchanged
                : { id: undefined, before: true }
            return
          }
          if (!clipDrag.isValidTarget(track, !!beforeTrackId)) {
            clipDrag.targetTrack = unchanged
            return
          }

          if (trackId) {
            clipDrag.targetTrack = { id, before: false }
          } else if (beforeTrackId) {
            const clipParentId = clipDrag.clip.parent?.id

            if (!track.head || (track.prev !== undefined && !track.prev.head)) {
              clipDrag.targetTrack = { id, before: false }
            } else if (
              (track.id === clipParentId || track.prev?.id === clipParentId) &&
              clipDrag.clipWasAloneInTrack
            )
              clipDrag.targetTrack = unchanged
            else clipDrag.targetTrack = { id, before: true }
          }
        },
        dragleave() {
          const { clipDrag } = editor.doc
          if (!clipDrag.isActive()) return
          clipDrag.targetTrack = { id: clipDrag.parent.id, before: false }
        },
      })

    onCleanup(dropzone.unset.bind(dropzone))
  })
}
