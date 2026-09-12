import { h } from 'fine-jsx/jsx-runtime'

import type * as pub from '#core'
import { Rational } from 'shared/utils/math.ts'

import { useEditor } from './components/utils.ts'

const RETURN_TRUE = (): true => true
const GAPPED = true as boolean

const getClipAtTime = (track: pub.AnyTrack, time: number): pub.AnyClip | undefined => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip
  }
}

const getSplitTarget = (editor: pub.VideoEditor): pub.AnyClip | undefined => {
  const { currentTime } = editor.doc
  const { selection } = editor
  const trackOfSelectedClip = selection && (selection.isNode ? selection : selection.node).parent

  // first search the track that contains a selected clip
  return trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)
}

const getLinkFromSelection = (editor: pub.VideoEditor) => {
  const { selection } = editor._editor
  return selection?.isNode && selection.isClip() ? selection.link : undefined
}

export const EDITOR_SELECTION_ACTIONS: pub.VideoEditorAction[] = [
  {
    id: 'split',
    localeKey: 'split',
    Icon: IconMsSplitSceneOutlineRounded,
    canPerform: (editor) => !!getSplitTarget(editor),
    exec: (editor) => {
      const targetClip = getSplitTarget(editor)
      if (!targetClip) return

      const { doc } = editor

      const linkedClips = targetClip.link?.nodes ?? [targetClip]
      const startNodes: typeof linkedClips = []
      const endNodes: typeof linkedClips = []

      linkedClips.forEach((clip) => {
        const result = editor.splitClip(doc.nodes.get(clip.id), editor.currentTime)
        if (result) {
          startNodes.push(result[0])
          endNodes.push(result[1])
        }
      })

      if (startNodes.length > 1) {
        doc.createLink({ id: editor.generateId(), nodes: startNodes })
        doc.createLink({ id: editor.generateId(), nodes: endNodes })
      }
    },
  },
  {
    id: 'delete',
    localeKey: 'delete',
    Icon: IconMsDeleteOutlineRounded,
    canPerform: RETURN_TRUE,
    exec: (editor) => {
      const { selection, doc } = editor._editor
      if (!selection) return

      if (!selection.isNode) {
        ;(selection.node.link?.nodes ?? [selection.node]).forEach((node) => {
          doc.nodes.get<pub.AnyClip>(node.id).gap = Rational.ZERO
        })
        return
      }

      const { link } = selection

      const nodes = link?.nodes.slice() ?? [selection]

      nodes.forEach((node) => {
        const { next, parent } = node
        const newGapDuration =
          GAPPED && node.isClip() && next
            ? node.gap.add(node.duration).add(node.next?.gap ?? Rational.ZERO)
            : Rational.ZERO

        node.delete()
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
          canPerform: (editor: pub.VideoEditor) => !!getLinkFromSelection(editor),
          exec(editor: pub.VideoEditor) {
            const link = getLinkFromSelection(editor)
            if (!link) return

            editor.doc.deleteLink(link.id)
          },
        },
      ]
    : []),
]

export const EDITOR_SELECTION_ACTIONS_BY_ID: Record<string, pub.VideoEditorAction> = Object.fromEntries(
  EDITOR_SELECTION_ACTIONS.map((action) => [action.id, action]),
)
