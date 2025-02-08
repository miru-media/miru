import { filesize } from 'filesize'
import { effect, ref, toRef } from 'fine-jsx'

import { type InputEvent } from 'shared/types'

import { ACCEPT_AUDIO_FILE_TYPES, ACCEPT_VIDEO_FILE_TYPES } from '../constants'
import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'
import { ToolbarButton } from './ToolbarButton'
import { VideoFilterMenu } from './VideoFilterMenu'

export const ClipActions = ({ editor }: { editor: VideoEditor }) => {
  const onInputVideoFile = async (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    await editor.replaceClipSource(file)
  }

  const getSelectedType = () => editor.selected.value?.track.type

  const showFiltersMenu = ref(false)

  effect(() => {
    if (editor.selected.value?.track.type !== 'video') showFiltersMenu.value = false
  })

  return (
    <div class="actions">
      {() => showFiltersMenu.value && <VideoFilterMenu editor={editor} />}

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

              {getSelectedType() === 'video' && (
                <IconButton
                  class={() => ['toolbar-button', editor.selected.value?.filter.value && 'active']}
                  icon={toRef(() =>
                    showFiltersMenu.value ? IconTablerFiltersFilled : IconTablerFilters,
                  )}
                  onClick={() => (showFiltersMenu.value = !showFiltersMenu.value)}
                >
                  Filter
                </IconButton>
              )}

              <ToolbarButton tag="label" icon={IconTablerExchange}>
                <input
                  type="file"
                  accept={getSelectedType() === 'audio' ? ACCEPT_AUDIO_FILE_TYPES : ACCEPT_VIDEO_FILE_TYPES}
                  disabled={() => !editor.selected.value}
                  onInput={onInputVideoFile}
                  hidden
                />
                Change {getSelectedType()}
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
    </div>
  )
}
