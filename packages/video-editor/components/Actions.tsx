import { filesize } from 'filesize'
import { toRef } from 'fine-jsx'

import { type InputEvent } from 'shared/types'

import { ACCEPT_VIDEO_FILE_TYPES } from '../cosntants'
import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'
import { ToolbarButton } from './ToolbarButton'

export const ClipActions = ({ editor }: { editor: VideoEditor }) => {
  const onInputVideoFile = async (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    await editor.replaceClipSource(file)
  }

  return (
    <div class="toolbar safe-padding-x">
      <IconButton class="toolbar-button" icon={IconTablerCut} onClick={() => editor.splitAtCurrentTime()}>
        Split
      </IconButton>

      {() =>
        editor.selected.value && (
          <>
            <IconButton class="toolbar-button" icon={IconTablerTrash} onClick={() => editor.delete()}>
              Delete
            </IconButton>
            {import.meta.env.DEV && (
              <IconButton
                class="toolbar-button"
                icon={IconTablerWand}
                onClick={() => alert('Not implemented.')}
              >
                Effects
              </IconButton>
            )}

            <ToolbarButton tag="label" icon={IconTablerExchange}>
              <input
                type="file"
                accept={ACCEPT_VIDEO_FILE_TYPES}
                disabled={() => !editor.selected.value}
                onInput={onInputVideoFile}
                hidden
              />
              Change video
            </ToolbarButton>
          </>
        )
      }

      <IconButton
        class="toolbar-button"
        icon={toRef(() => (editor.showStats.value ? IconTablerGraphFilled : IconTablerGraph))}
        onClick={() => (editor.showStats.value = !editor.showStats.value)}
      >
        Debug
      </IconButton>

      {import.meta.env.DEV && (
        <IconButton
          class="toolbar-button"
          icon={IconTablerCodeDots}
          // eslint-disable-next-line no-console
          onClick={() => console.info(editor.movie.tracks.value.map((t) => t.toObject()))}
        >
          Log state
        </IconButton>
      )}

      <IconButton class="toolbar-button" icon={IconTablerDownload} onClick={() => editor.startExport()}>
        Export
      </IconButton>

      {() => {
        const result = editor.exportResult.value
        if (!result) return
        const { blob, url } = result

        return (
          <a
            href={url}
            target="_blank"
            style="border-radius: 0.5rem; background: var(--gray); padding: 0 1rem; cursor: pointer"
          >
            {blob.type} {filesize(blob.size)}
          </a>
        )
      }}
    </div>
  )
}
