import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const ClipActions = ({ editor }: { editor: VideoEditor }) => {
  const buttons = [
    { icon: IconTablerTrash, onClick: () => editor.delete() },
    {
      icon: IconTablerAdjustments,
      onClick: () => {
        throw new Error('Not implemented.')
      },
    },
  ]

  return (
    <div>
      {buttons.map(({ icon, onClick }) => (
        <IconButton icon={icon} onClick={onClick}></IconButton>
      ))}
    </div>
  )
}
