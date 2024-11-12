import { ref } from '@/framework/reactivity'
import { type InputEvent, type Size } from '@/types'
import { useEventListener } from '@/utils'

import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const Settings = ({ editor }: { editor: VideoEditor }) => {
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
    <div ref={root} class={() => ['settings-controls', isOpen.value && 'is-open']}>
      <IconButton
        icon={IconTablerSettings}
        class="settings-button"
        onClick={() => (isOpen.value = !isOpen.value)}
      >
        <span class="sr-only">Settings</span>
      </IconButton>

      <div class="settings-content">
        <label>
          Resolution
          <select
            class="settings-resolution"
            onInput={(event: InputEvent) => {
              editor.movie.resolution.value = JSON.parse(event.target.value) as Size
            }}
            value={() => JSON.stringify(editor.movie.resolution.value)}
          >
            {resolutionOptions.map(({ value, label }) => (
              <option value={JSON.stringify(value)}>{label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
