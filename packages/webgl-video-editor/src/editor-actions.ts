import { h } from 'fine-jsx/jsx-runtime'

import type { AnyClip, Track, VideoEditor, VideoEditorAction } from '#core'
import { Rational } from 'shared/utils/math.ts'

import { useEditor } from './components/utils.ts'

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

const getLinkFromSelection = (editor: VideoEditor) => {
  const { selection } = editor._editor
  return selection?.isNode && selection.isClip() ? selection.link : undefined
}

export const EDITOR_SELECTION_ACTIONS: VideoEditorAction[] = [
  {
    id: 'split',
    localeKey: 'split',
    Icon: IconMsSplitSceneOutlineRounded,
    canPerform: (editor) => !!getSplitTarget(editor),
    exec: (editor) => {
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
    exec: (editor) => {
      const { selection, doc } = editor
      if (!selection) return

      if (!selection.isNode) {
        selection.node.gap = Rational.ZERO
        return
      }

      const { next, parent } = selection
      const link = doc.getLinkOf(selection.id)

      editor._editor._transact(() => {
        if (link) doc.deleteLink(link.id)

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
  ...(import.meta.env.DEV
    ? [
        {
          id: 'unlink',
          localeKey: 'unlink_clips',
          Icon: () => {
            const editor = useEditor()
            return h('#fragment', {
              children: () => h(getLinkFromSelection(editor) ? IconMsLinkOffRounded : IconMsLinkRounded, {}),
            })
          },
          canPerform: (editor: VideoEditor) => !!getLinkFromSelection(editor),
          exec(editor: VideoEditor) {
            const link = getLinkFromSelection(editor)
            if (!link) return

            editor._editor._transact(() => editor.doc.deleteLink(link.id))
          },
        },
      ]
    : []),
]

export const EDITOR_SELECTION_ACTIONS_BY_ID: Record<string, VideoEditorAction> = Object.fromEntries(
  EDITOR_SELECTION_ACTIONS.map((action) => [action.id, action]),
)
