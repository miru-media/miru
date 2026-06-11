import type { VideoEditor, VideoEditorAction } from '#core'
import { Rational } from 'shared/utils/math.ts'

const RETURN_TRUE = (): true => true
const GAPPED = true as boolean

export const EDITOR_SELECTION_ACTIONS: VideoEditorAction[] = [
  {
    id: 'split',
    localeKey: 'split',
    Icon: IconMsSplitSceneOutlineRounded,
    canPerform: (editor: VideoEditor) => !!(editor.selection?.isNode && editor.selection.isClip()),
    exec: (editor: VideoEditor) => {
      const { selection } = editor
      if (!selection?.isNode || !selection.isClip()) return

      editor._editor._transact(() => editor.splitClip(selection, editor.currentTime))
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
