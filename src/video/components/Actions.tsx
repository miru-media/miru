import { toRef } from '@/framework/reactivity'
import { type InputEvent } from '@/types'

import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const ClipActions = ({ editor }: { editor: VideoEditor }) => {
  const onInputVideoFile = (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    editor.selected.value?.setMedia(URL.createObjectURL(file))
  }

  return (
    <div class="toolbar">
      <IconButton class="toolbar-button" icon={IconTablerCut} onClick={() => editor.splitAtCurrentTime()} />
      <IconButton class="toolbar-button" icon={IconTablerTrash} onClick={() => editor.delete()} />
      <IconButton class="toolbar-button" icon={IconTablerWand} onClick={() => alert('Not implemented.')} />

      <label class="icon-button toolbar-button">
        <IconTablerExchange />
        <input
          type="file"
          accept="video/*"
          disabled={() => !editor.selected.value}
          onInput={onInputVideoFile}
          hidden
        />
        <span class="sr-only">Change video</span>
      </label>

      <IconButton
        class="toolbar-button"
        icon={toRef(() => (editor.showStats.value ? IconTablerGraphFilled : IconTablerGraph))}
        onClick={() => (editor.showStats.value = !editor.showStats.value)}
      />
    </div>
  )
}
