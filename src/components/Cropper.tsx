import { InputEvent } from '@/types'
import { RowSlider } from './RowSlider'
import { useCrop } from './useCrop'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { Component } from '@/framework/jsx-runtime'
import { toValue } from '@/framework/reactivity'

export const CropView: Component<{ engine: ImageEditorEngine; sourceIndex: number }> = (props) => {
  const engine = toValue(props.engine)
  const { aspectRatio, resetCrop, setAspectRatio, rotate, container, zoom, setZoom } = useCrop({
    engine,
    sourceIndex: toValue(props.sourceIndex),
  })

  return (
    <>
      {container}
      <div class="miru--menu">
        <p class="miru--menu__row">
          <button
            class={['miru--button', () => (aspectRatio.value === -1 ? 'miru--acc' : '')]}
            type="button"
            onClick={resetCrop}
          >
            <IconTablerCircleOff class="miru--button__icon" />
            <span class="miru--button__label">Original</span>
          </button>

          {[
            { value: 9 / 16, Icon: IconTablerCropPortrait, label: '9:16' },
            { value: 1 / 1, Icon: IconTablerCrop_1_1, label: '1:1' },
            { value: 16 / 9, Icon: IconTablerCropLandscape, label: '16:9' },
          ].map(({ value, Icon, label }) => (
            <button
              class={() => ['miru--button', aspectRatio.value.toFixed(1) === value.toFixed(1) && 'miru--acc']}
              type="button"
              onClick={() => setAspectRatio(value)}
            >
              <Icon class="miru--button__icon" />
              <span class="miru--button__label">{label}</span>
            </button>
          ))}

          <button class="miru--button" type="button" onClick={rotate}>
            <IconTablerRotateClockwise class="miru--button__icon" />
            <span class="miru--button__label">Rotate</span>
          </button>
        </p>

        {RowSlider({
          label: 'Scale',
          min: 0.1,
          max: 2,
          value: zoom,
          onInput: (event: InputEvent) => setZoom(event.target.valueAsNumber),
        })}
      </div>
    </>
  )
}
