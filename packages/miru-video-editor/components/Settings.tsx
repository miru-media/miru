import { ref } from 'fine-jsx'

import { type InputEvent, type Size } from 'shared/types'
import { useEventListener, useI18n } from 'shared/utils'

import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const Settings = ({ editor }: { editor: VideoEditor }) => {
  const { t, tr } = useI18n()

  const isOpen = ref(false)
  const root = ref<HTMLElement>()
  const resolutionOptions = [
    { value: { width: 1920, height: 1080 }, label: '1920 x 1080' },
    { value: { width: 1080, height: 1920 }, label: '1080 x 1920' },
  ]

  useEventListener(
    () => root.value?.getRootNode(),
    'pointerdown',
    (event) => {
      if (!isOpen.value || !root.value) return
      if (!event.composedPath().includes(root.value)) isOpen.value = false
    },
  )

  return (
    <div ref={root} class={() => ['settings-controls safe-padding-x', isOpen.value && 'is-open']}>
      <IconButton
        icon={IconTablerSettings}
        class="settings-button overlay"
        title={tr('Settings')}
        onClick={() => (isOpen.value = !isOpen.value)}
      >
        <span class="sr-only">{tr('Settings')}</span>
      </IconButton>

      <div class="settings-content">
        <label>
          {tr('Resolution')}
          <select
            class="settings-resolution"
            onInput={(event: InputEvent) => {
              editor._movie.resolution = JSON.parse(event.target.value) as Size
            }}
            value={() => JSON.stringify(editor._movie.resolution)}
          >
            {resolutionOptions.map(({ value, label }) => (
              <option value={JSON.stringify(value)}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          {tr('Frame rate')}
          <select
            class="settings-frame-rate"
            onInput={(event: InputEvent) => {
              editor._movie.frameRate.value = parseInt(event.target.value)
            }}
            value={() => JSON.stringify(editor._movie.frameRate.value)}
          >
            {[24, 25, 30, 48, 50, 60].map((value) => (
              <option value={value}>{value}</option>
            ))}
          </select>
        </label>

        <IconButton
          icon={IconTablerTrash}
          type="button"
          onClick={() => {
            if (!window.confirm(t(`Are you sure you want to delete your video? \n\nThis can't be undone.`)))
              return
            return editor.clearAllContentAndHistory()
          }}
          disabled={() => editor._movie.isEmpty}
        >
          &nbsp;{tr('Delete all content')}
        </IconButton>
      </div>
    </div>
  )
}
