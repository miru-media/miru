import { ref } from 'fine-jsx'

import { type InputEvent, type Size } from 'shared/types'
import { useEventListener, useI18n } from 'shared/utils'

import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const Settings = ({ editor }: { editor: VideoEditor }) => {
  const { t } = useI18n()

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
        title={t('Settings')}
        onClick={() => (isOpen.value = !isOpen.value)}
      >
        <span class="sr-only">{t('Settings')}</span>
      </IconButton>

      <div class="settings-content">
        <label>
          {t('Resolution')}
          <select
            class="settings-resolution"
            onInput={(event: InputEvent) => {
              editor.movie.resolution = JSON.parse(event.target.value) as Size
            }}
            value={() => JSON.stringify(editor.movie.resolution)}
          >
            {resolutionOptions.map(({ value, label }) => (
              <option value={JSON.stringify(value)}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          {t('Frame rate')}
          <select
            class="settings-frame-rate"
            onInput={(event: InputEvent) => {
              editor.movie.frameRate.value = parseInt(event.target.value)
            }}
            value={() => JSON.stringify(editor.movie.frameRate.value)}
          >
            {[24, 25, 30, 48, 50, 60].map((value) => (
              <option value={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
