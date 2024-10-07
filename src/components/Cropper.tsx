import { InputEvent } from '@/types'
import { RowSlider } from './RowSlider'
import { useCrop } from './useCrop'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { Component } from '@/framework/jsx-runtime'
import { toValue } from '@/framework/reactivity'

export const CropView: Component<{ engine: ImageEditorEngine; sourceIndex: number }> = (props) => {
  const engine = toValue(props.engine)
  const { aspectRatio, resetCrop, setAspectRatio, cropper, container, zoom, setZoom } = useCrop({
    engine,
    sourceIndex: toValue(props.sourceIndex),
  })

  // TODO: fragment
  return (
    <div class="miru--center">
      {container}
      <div class="miru--menu">
        <p class="miru--menu__row">
          <button
            class={['miru--button', () => (aspectRatio.value === -1 ? 'miru--acc' : '')]}
            type="button"
            onClick={resetCrop}
          >
            <div class="i-tabler:frame-off miru--button__icon"></div>
            <label class="miru--button__label">No Crop</label>
          </button>

          {[
            { value: 9 / 16, icon: 'i-tabler:crop-portrait', label: '9/16' },
            { value: 1 / 1, icon: 'i-tabler:crop-1-1', label: '1/1' },
            { value: 16 / 9, icon: 'i-tabler:crop-landscape', label: '16/9' },
          ].map(({ value, icon, label }) => (
            <button
              class={() => ['miru--button', aspectRatio.value.toFixed(1) === value.toFixed(1) && 'miru--acc']}
              type="button"
              onClick={() => setAspectRatio(value)}
            >
              <div class={`${icon} miru--button__icon`}></div>
              <label class="miru--button__label">{label}</label>
            </button>
          ))}

          <button class="miru--button" type="button" onClick={() => cropper.value?.rotate(90)}>
            <div class="i-tabler:rotate-clockwise miru--button__icon"></div>
            <label class="miru--button__label">Rotate</label>
          </button>
        </p>

        {RowSlider({
          min: 0.1,
          max: 2,
          value: zoom,
          onInput: (event: InputEvent) => setZoom(event.target.valueAsNumber),
        })}
      </div>
    </div>
  )
}
