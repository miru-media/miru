import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { InputEvent } from '@/types'
import { RowSlider } from './RowSlider'
import { SourcePreview } from './SourcePreview'

export const AdjustmentsView = ({ engine }: { engine: ImageEditorEngine }) => {
  const { sources, currentSource } = engine

  const onAdjustmentIntensity = (event: InputEvent) => {
    const source = currentSource.value!
    if (!source) return

    source.adjustments.value = {
      contrast: 0,
      saturation: 0,
      ...source.adjustments.value,
      brightness: event.target.valueAsNumber,
    }
  }

  return (
    // TODO: fragment
    <div class="miru--center">
      {() => {
        return sources.value.map((_source, index) => <SourcePreview engine={engine} sourceIndex={index} />)
      }}
      <div class="miru--menu">
        <p class="miru--menu__row">
          <button class="miru--button miru--acc" type="button">
            <div class="i-tabler:sun miru--button__icon"></div>
            <label class="miru--button__label">Brightness</label>
          </button>

          <button class="miru--button" type="button">
            <div class="i-tabler:contrast-filled miru--button__icon"></div>
            <label class="miru--button__label">Contrast</label>
          </button>
        </p>

        {RowSlider({
          min: -1,
          max: 1,
          value: () => currentSource.value?.adjustments.value?.brightness,
          oninput: onAdjustmentIntensity,
        })}
      </div>

      {/* spacer */}
      <div />
    </div>
  )
}
