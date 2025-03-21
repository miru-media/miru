import { filesize } from 'filesize'
import { effect, ref, toRef } from 'fine-jsx'
import { debounce } from 'throttle-debounce'

import { type InputEvent } from 'shared/types'
import { useEventListener, useI18n } from 'shared/utils'

import { ACCEPT_AUDIO_FILE_TYPES, ACCEPT_VIDEO_FILE_TYPES } from '../constants'
import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'
import { ToolbarButton } from './ToolbarButton'
import { VideoFilterMenu } from './VideoFilterMenu'

export const ClipActions = ({ editor }: { editor: VideoEditor }) => {
  const { tr } = useI18n()
  const onInputVideoFile = async (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    await editor.replaceClipSource(file)
  }

  const getSelectedType = () => editor.selection?.parent.trackType

  const showFiltersMenu = ref(false)

  effect(() => {
    if (editor.selection?.parent.trackType !== 'video') showFiltersMenu.value = false
  })

  const showDebugButtons = ref(import.meta.env.DEV)
  const tapCounter = ref(0)
  const clearCounterDebounced = debounce(500, () => (tapCounter.value = 0))
  useEventListener(
    () => editor._movie.canvas,
    'pointerup',
    () => {
      if (++tapCounter.value === 7) showDebugButtons.value = !showDebugButtons.value
      clearCounterDebounced()
    },
  )

  return (
    <div class="actions">
      {() => showFiltersMenu.value && <VideoFilterMenu editor={editor} />}

      <div class="toolbar safe-padding-x">
        <IconButton
          class="toolbar-button"
          icon={IconTablerCut}
          onClick={() => editor.splitClipAtCurrentTime()}
        >
          {tr('Split')}
        </IconButton>

        {() =>
          editor.selection && (
            <>
              <IconButton
                class="toolbar-button"
                icon={IconTablerTrash}
                onClick={() => editor.deleteSelection()}
              >
                {tr('Delete')}
              </IconButton>

              {getSelectedType() === 'video' && (
                <IconButton
                  class={() => ['toolbar-button', editor.selection?.filter.value && 'active']}
                  icon={toRef(() => (showFiltersMenu.value ? IconTablerFiltersFilled : IconTablerFilters))}
                  onClick={() => (showFiltersMenu.value = !showFiltersMenu.value)}
                >
                  {tr('Filter')}
                </IconButton>
              )}

              <ToolbarButton tag="label" icon={IconTablerExchange}>
                <input
                  type="file"
                  accept={getSelectedType() === 'audio' ? ACCEPT_AUDIO_FILE_TYPES : ACCEPT_VIDEO_FILE_TYPES}
                  disabled={() => !editor.selection}
                  onInput={onInputVideoFile}
                  hidden
                />
                {tr(`Change ${getSelectedType() ?? ''}`)}
              </ToolbarButton>
            </>
          )
        }

        {() =>
          showDebugButtons.value && (
            <>
              <IconButton
                class="toolbar-button"
                icon={IconTablerCodeDots}
                // eslint-disable-next-line no-console
                onClick={() => console.info(editor._movie.children.map((t) => t.toObject()))}
              >
                {tr('Log state')}
              </IconButton>
              <IconButton
                class="toolbar-button"
                icon={toRef(() => (editor._showStats.value ? IconTablerGraphFilled : IconTablerGraph))}
                onClick={() => (editor._showStats.value = !editor._showStats.value)}
              >
                {tr('Debug')}
              </IconButton>
            </>
          )
        }

        <IconButton class="toolbar-button" icon={IconTablerDownload} onClick={() => editor.export()}>
          {tr('Export')}
        </IconButton>

        {() => {
          if (!editor.exportResult) return
          const { blob, url } = editor.exportResult

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
