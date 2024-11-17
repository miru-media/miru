import { computed, type MaybeRefOrGetter, ref, toRef, toValue } from '@/framework/reactivity'
import { type AdjustmentsState, type InputEvent } from '@/types'

import { type ImageEditor } from '../ImageEditor'
import { type ImageSourceInternal } from '../ImageSourceInternal'

import { RowSlider } from './RowSlider'
import { SourcePreview } from './SourcePreview'

export const AdjustmentsView = ({
  editor,
  sourceIndex,
  showPreviews,
}: {
  editor: ImageEditor
  sourceIndex: MaybeRefOrGetter<number>
  showPreviews?: MaybeRefOrGetter<boolean | undefined>
}) => {
  const source = computed((): ImageSourceInternal | undefined => editor.sources.value[toValue(sourceIndex)])
  const { sources } = editor

  const currentType = ref<keyof AdjustmentsState>('brightness')
  const labels = {
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
  }

  const onInputSlider = (event: InputEvent) => {
    const $source = source.value
    if ($source == undefined) return

    const saved_value = $source.adjustments.value?.[currentType.value] ?? 0
    const direction = event.target.valueAsNumber > saved_value ? 1 : -1
    const should_snap =
      (direction == 1 && event.target.valueAsNumber > 0 && event.target.valueAsNumber <= 0.15) ||
      (direction == -1 && event.target.valueAsNumber < 0 && event.target.valueAsNumber >= -0.15)

    $source.adjustments.value = {
      ...($source.adjustments.value ?? {
        brightness: 0,
        contrast: 0,
        saturation: 0,
      }),
      [currentType.value]: should_snap ? 0 : event.target.valueAsNumber,
    }
  }

  const onChangeSlider = (event: InputEvent) => {
    event.target.valueAsNumber = source.value?.adjustments.value?.[currentType.value] ?? 0
  }

  return (
    <>
      {() =>
        toValue(showPreviews) == true &&
        sources.value.map((_source, index) => <SourcePreview editor={editor} sourceIndex={index} />)
      }
      <div class="miru--menu">
        <p class="miru--menu__row">
          {() =>
            (
              [
                { type: 'brightness', Icon: IconTablerSun },
                { type: 'contrast', Icon: IconTablerContrastFilled },
                { type: 'saturation', Icon: IconTablerDropletHalfFilled },
              ] as const
            ).map(({ type, Icon }) => (
              <button
                type="button"
                class={[
                  'miru--button',
                  () => currentType.value === type && 'miru--acc',
                  () => ((source.value?.adjustments.value?.[type] ?? 0) ? 'miru--enabled' : ''),
                ]}
                onClick={() => (currentType.value = type)}
              >
                <Icon class="miru--button__icon" />
                <span class="miru--button__label">{labels[type]}</span>
              </button>
            ))
          }
        </p>

        {RowSlider({
          label: computed(() => labels[currentType.value]),
          // label: 'Reset',
          min: -1,
          max: 1,
          value: toRef(() => source.value?.adjustments.value?.[currentType.value] ?? 0),
          onInput: onInputSlider,
          onChange: onChangeSlider,
        })}
      </div>
    </>
  )
}
