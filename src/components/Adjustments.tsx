import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { AdjustmentsState, InputEvent } from '@/types'
import { RowSlider } from './RowSlider'
import { SourcePreview } from './SourcePreview'
import { MaybeRefOrGetter, computed, ref, toValue } from '@/framework/reactivity'
import { ImageSourceState } from '@/engine/ImageSourceState'
import { useTogleEdit } from './useToggleEdit'

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

  const currentType = ref<keyof AdjustmentsState>('brightness')
  const labels = {
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
  }

  const onInputSlider = (event: InputEvent) => {
    const $source = source.value
    if (!$source) return

    clearSavedValue()

    $source.adjustments.value = {
      ...($source.adjustments.value ?? {
        brightness: 0,
        contrast: 0,
        saturation: 0,
      }),
      [currentType.value]: event.target.valueAsNumber,
    }
  }

  const { /* hasSavedValue, toggle, */ clearSavedValue } = useTogleEdit(source, 'adjustments')

  return (
    <>
      {() =>
        toValue(showPreviews) &&
        sources.value.map((_source, index) => <SourcePreview engine={engine} sourceIndex={index} />)
      }
      <div class="miru--menu">
        <p class="miru--menu__row">
          {() =>
            (
              [
                { type: 'brightness', icon: 'i-tabler:sun' },
                { type: 'contrast', icon: 'i-tabler:contrast-filled' },
                { type: 'saturation', icon: 'i-tabler:droplet-half-filled' },
              ] as const
            ).map(({ type, icon }) => (
              <button
                type="button"
                class={[
                  'miru--button',
                  () => currentType.value === type && 'miru--acc',
                  () => (source.value?.adjustments.value?.[type] ? 'miru--enabled' : ''),
                ]}
                onClick={() => (currentType.value = type)}
              >
                <div class={`${icon} miru--button__icon`}></div>
                <span class="miru--button__label">{labels[type]}</span>
              </button>
            ))
          }
        </p>

        {RowSlider({
          // label: () => labels[currentType.value],
          label: 'Reset',
          min: -1,
          max: 1,
          value: () =>
            source.value?.adjustments.value?.[currentType.value]
              ? source.value?.adjustments.value?.[currentType.value]
              : 0,
          oninput: onInputSlider,
          default_value: 0,
        })}
      </div>
    </>
  )
}
