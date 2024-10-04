import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { InputEvent } from '@/types'
import { RowSlider } from './RowSlider'
import { SourcePreview } from './SourcePreview'
import { MaybeRefOrGetter, computed, toValue } from '@/framework/reactivity'
import { ImageSourceState } from '@/engine/ImageSourceState'

export const AdjustmentsView = ({
  engine,
  sourceIndex,
  showPreviews,
}: {
  engine: ImageEditorEngine
  sourceIndex: MaybeRefOrGetter<number>
  showPreviews?: MaybeRefOrGetter<boolean | undefined>
}) => {
  const source = computed((): ImageSourceState | undefined => engine.sources.value[toValue(sourceIndex)])
  const { sources } = engine

  const onAdjustmentIntensity = (event: InputEvent) => {
    const $source = source.value!
    if (!$source) return

    $source.adjustments.value = {
      contrast: 0,
      saturation: 0,
      ...$source.adjustments.value,
      brightness: event.target.valueAsNumber,
    }
  }

  return (
    // TODO: fragment
    <div class="miru--center">
      {() =>
        toValue(showPreviews) &&
        sources.value.map((_source, index) => <SourcePreview engine={engine} sourceIndex={index} />)
      }
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
          value: () => source.value?.adjustments.value?.brightness,
          oninput: onAdjustmentIntensity,
        })}
      </div>

      {/* spacer */}
      <div />
    </div>
  )
}
