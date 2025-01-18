/* eslint-disable no-console -- demo */
// eslint-disable-next-line import/no-unresolved
import 'uno.css'

import { createEffectScope, effect, ref, render } from 'fine-jsx'

import { trim } from '.'

import { type LoadInfo, type TrimState } from './VideoTrimmerUI'

const source = ref('')
const state = ref<TrimState>()

const progress = ref(0)
const trimmedBlob = ref<Blob>()
const resultUrl = ref<string>()

effect((onCleanup) => {
  const blob = trimmedBlob.value
  const blobUrl = (resultUrl.value = blob ? URL.createObjectURL(blob) : '')
  resultUrl.value = blobUrl
  onCleanup(() => URL.revokeObjectURL(blobUrl))
})

const exportVideo = async () => {
  trimmedBlob.value = undefined
  if (!state.value) return

  try {
    trimmedBlob.value = await trim(source.value, {
      ...state.value,
      onProgress: (value) => (progress.value = value),
    })
  } catch (error) {
    alert(error)
  }
}

const onChange = (event: CustomEvent<TrimState>) => {
  console.log(event.type, event.detail)
  state.value = event.detail
}

const onLoad = (event: CustomEvent<LoadInfo>) => {
  console.log(event.type, event.detail)
  state.value = { start: 0, end: event.detail.duration, mute: false }
}

const onError = (event: CustomEvent<unknown>) => console.error(event.detail)

const inputFile = ref<File>()

createEffectScope().run(() => {
  render(
    <div class="max-h-90vh @dark:text-#9ca3af bg-white text-black">
      <media-trimmer
        class="block w-full @dark:bg-#171717 p-0.5rem box-border"
        source={source}
        state={state}
        onChange={onChange}
        onLoad={onLoad}
        onError={onError}
      ></media-trimmer>
      <progress class="block w-full border-0" value={progress} max="1" />
      <div class="flex items-center">
        <input
          type="file"
          accept="video/*"
          onInput={(event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0]
            if (file) {
              inputFile.value = file
              URL.revokeObjectURL(source.value)
              source.value = URL.createObjectURL(file)
            }
          }}
        />

        <button
          type="button"
          onClick={exportVideo}
          disabled={() => !state.value}
          style="padding: 1rem; border: solid white"
        >
          Export
        </button>

        {() =>
          resultUrl.value && (
            <a
              href={resultUrl}
              target="_blank"
              download={() => `trimmed${inputFile.value ? '-' + inputFile.value.name : ''}.mp4`}
            >
              Download
            </a>
          )
        }
      </div>
      <video
        src={resultUrl}
        height="300"
        autoplay="true"
        controls
        class={() => !resultUrl.value && 'hidden'}
      />
    </div>,
    document.getElementById('app')!,
  )
})
