import type { AnyClip, Track, VideoEditor, VideoEditorAction } from '#core'
import { Rational } from 'shared/utils/math.ts'

const RETURN_TRUE = (): true => true
const GAPPED = true as boolean

const getClipAtTime = (track: Track, time: number): AnyClip | undefined => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip
  }
}

const getSplitTarget = (editor: VideoEditor): AnyClip | undefined => {
  const { currentTime } = editor.doc
  const { selection } = editor
  const trackOfSelectedClip = selection && (selection.isNode ? selection : selection.node).parent

  // first search the track that contains a selected clip
  return trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)
}

export const EDITOR_SELECTION_ACTIONS: VideoEditorAction[] = [
  {
    id: 'split',
    localeKey: 'split',
    Icon: IconMsSplitSceneOutlineRounded,
    canPerform: (editor: VideoEditor) => !!getSplitTarget(editor),
    exec: (editor: VideoEditor) => {
      const clip = getSplitTarget(editor)
      if (!clip) return

      editor._editor._transact(() => editor.splitClip(clip, editor.currentTime))
    },
  },
  {
    id: 'delete',
    localeKey: 'delete',
    Icon: IconMsDeleteOutlineRounded,
    canPerform: RETURN_TRUE,
    exec: (editor: VideoEditor) => {
      const { selection } = editor
      if (!selection) return

      if (!selection.isNode) {
        selection.node.gap = Rational.ZERO
        return
      }

      const { next, parent } = selection

      editor._editor._transact(() => {
        const newGapDuration =
          GAPPED && selection.isClip() && next
            ? selection.gap.add(selection.duration).add(selection.next?.gap ?? Rational.ZERO)
            : Rational.ZERO

        selection.delete()
        if (next) next.gap = newGapDuration
        if (!parent?.head) parent?.delete()
      })
    },
  },
]

export const EDITOR_SELECTION_ACTIONS_BY_ID: Record<string, VideoEditorAction> = Object.fromEntries(
  EDITOR_SELECTION_ACTIONS.map((action) => [action.id, action]),
)
