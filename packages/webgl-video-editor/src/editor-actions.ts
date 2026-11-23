import { h } from 'fine-jsx/jsx-runtime'

import type * as pub from '#core'
import { Rational } from 'shared/utils/math.ts'
import { rangeContainsTime } from 'shared/video/utils.ts'

import { useEditor } from './components/utils.ts'

const RETURN_TRUE = (): true => true

const getClipAtTime = (track: pub.AnyTrack, time: number): pub.AnyClip | undefined => {
  for (let clip = track.head; clip; clip = clip.next) {
    const clipTime = clip.time

    if (clipTime.start <= time && time < clipTime.end) return clip
  }
}

const getSplitTargets = (editor: pub.VideoEditor): pub.AnyClip[] => {
  const { currentTime } = editor.doc
  const { selection } = editor

  if (selection.items.length === 1) {
    const item = selection.items[0]
    const trackOfSelectedClip = (item.isNode ? item : item.node).parent

    // first search the track that contains a selected clip
    const result = trackOfSelectedClip && getClipAtTime(trackOfSelectedClip, currentTime)
    return result ? [result] : []
  }

  return selection.nodes.filter((node) => rangeContainsTime(node.time, currentTime))
}

const getLinkFromSelection = (editor: pub.VideoEditor) => {
  const { nodes } = editor.selection
  if (!nodes.length) return
  const firstLink = nodes[0].link

  return firstLink && nodes.every((node) => node.link?.id === firstLink.id) ? firstLink : undefined
}

export const EDITOR_SELECTION_ACTIONS: pub.VideoEditorAction[] = [
  {
    id: 'split',
    localeKey: 'split',
    Icon: IconMsSplitSceneOutlineRounded,
    canPerform: (editor) => !!getSplitTargets(editor).length,
    exec: (editor) => {
      const targetClips = getSplitTargets(editor)
      if (!targetClips.length) return

      const { doc } = editor

      const linkedClips = targetClips.flatMap((clip) => clip.link?.nodes ?? clip)
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
      const { doc, selection } = editor._editor
      const { nodes, gaps } = selection

      // delete gaps before deleting nodes changes children the gap map IDs
      gaps.forEach((item) => {
        const linkedNodes = (item.node.link?.nodes ?? [item.node]).map((node) =>
          doc.nodes.get<pub.AnyClip>(node.id),
        )
        const minGap = linkedNodes.reduce(
          (acc, node) => (node.gap.value === 0 ? acc : Rational.min(acc, node.gap)),
          item.node.gap,
        )
        linkedNodes.forEach((node) => {
          node.gap = Rational.max(node.gap.subtract(minGap), Rational.ZERO)
        })
      })

      nodes.forEach((item) => {
        const { link } = item

        const linkedNodes = link?.nodes.slice() ?? [item]

        linkedNodes.forEach((linkedNode) => {
          const node = doc.nodes.get<pub.AnyClip>(linkedNode.id)
          const { next, parent } = node
          next?.setGap(node.prev?.id, node.gap.add(next.gap))

          node.delete()
          if (!parent?.head) parent?.delete()
        })
      })

      selection.clear()
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
