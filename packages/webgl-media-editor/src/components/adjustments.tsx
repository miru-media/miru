import { computed, type MaybeRefOrGetter, ref, toRef, toValue } from 'fine-jsx'

import type { AdjustmentsState, InputEvent } from 'shared/types'

import type { ImageSourceInternal } from '../image-source-internal.ts'
import type { MediaEditor } from '../media-editor.ts'

import { RowSlider } from './row-slider.jsx'
import { SourcePreview } from './source-preview.jsx'

const SNAP_MARGIN = 0.15

export const AdjustmentsView = ({
  editor,
  sourceIndex,
  showPreviews,
}: {
  editor: MediaEditor
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
    if ($source == null) return

    const savedValue = $source.adjustments.value?.[currentType.value] ?? 0
    const direction = event.target.valueAsNumber > savedValue ? 1 : -1
    const shouldSnap =
      (direction === 1 && event.target.valueAsNumber > 0 && event.target.valueAsNumber <= SNAP_MARGIN) ||
      (direction === -1 && event.target.valueAsNumber < 0 && event.target.valueAsNumber >= -SNAP_MARGIN)

    $source.adjustments.value = {
      ...($source.adjustments.value ?? {
        brightness: 0,
        contrast: 0,
        saturation: 0,
      }),
      [currentType.value]: shouldSnap ? 0 : event.target.valueAsNumber,
    }
  }

  const onChangeSlider = (event: InputEvent) => {
    event.target.valueAsNumber = source.value?.adjustments.value?.[currentType.value] ?? 0
  }

  return (
    <>
      {() =>
        toValue(showPreviews) === true &&
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
