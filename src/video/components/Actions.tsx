import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const ClipActions = ({ editor }: { editor: VideoEditor }) => {
  const buttons = [
    { icon: IconTablerCut, onClick: () => editor.splitAtCurrentTime() },
    { icon: IconTablerTrash, onClick: () => editor.delete() },
    { icon: IconTablerWand, onClick: () => alert('Not implemented.') },
  ]

  return (
    <div class="toolbar">
      {buttons.map(({ icon, onClick }) => (
        <IconButton class="toolbar-button" icon={icon} onClick={onClick}></IconButton>
      ))}
    </div>
  )
}
