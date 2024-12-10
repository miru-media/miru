import { filesize } from 'filesize'

import { toRef } from 'shared/framework/reactivity'
import { type InputEvent } from 'shared/types'

import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const ClipActions = ({ editor }: { editor: VideoEditor }) => {
  const onInputVideoFile = async (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    await editor.replaceClipSource(file)
  }

  return (
    <div class="toolbar safe-padding-x">
      <IconButton class="toolbar-button" icon={IconTablerCut} onClick={() => editor.splitAtCurrentTime()} />
      <IconButton class="toolbar-button" icon={IconTablerTrash} onClick={() => editor.delete()} />
      {import.meta.env.DEV && (
        <IconButton class="toolbar-button" icon={IconTablerWand} onClick={() => alert('Not implemented.')} />
      )}

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

      {import.meta.env.DEV && (
        <IconButton
          class="toolbar-button"
          icon={IconTablerCodeDots}
          // eslint-disable-next-line no-console
          onClick={() => console.info(editor.movie.tracks.value.map((t) => t.toObject()))}
        />
      )}

      <IconButton class="toolbar-button" icon={IconTablerDownload} onClick={() => editor.startExport()} />

      {() => {
        const blob = editor.exportedBlob.value
        if (blob == undefined) return

        return (
          <button
            type="button"
            onClick={() => window.open(URL.createObjectURL(blob))}
            style="border-radius: 0.5rem; background: var(--gray); padding: 0 1rem; cursor: pointer"
          >
            {blob.type} {filesize(blob.size)}
          </button>
        )
      }}
    </div>
  )
}
