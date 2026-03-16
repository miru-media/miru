import { computed, type MaybeRefOrGetter, toRef, toValue } from 'fine-jsx'

import type { AdjustmentsState, InputEvent } from 'shared/types'

import styles from '../css/index.module.css'
import type { ImageSourceInternal } from '../image-source-internal.ts'
import type { MediaEditor } from '../media-editor.ts'

import { RowSlider } from './row-slider.jsx'
import { SourcePreview } from './source-preview.jsx'

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

  const sliders = [
    { key: 'brightness' as const, label: 'Brightness', Icon: IconTablerSun },
    { key: 'contrast' as const, label: 'Contrast', Icon: IconTablerContrastFilled },
    { key: 'saturation' as const, label: 'Saturation', Icon: IconTablerDropletHalfFilled },
  ]

  const onInputSlider = (event: InputEvent, attr: keyof AdjustmentsState): void => {
    const $source = source.value
    if ($source == null) return
    $source.adjustments.value = {
      ...($source.adjustments.value ?? {
        brightness: 0,
        contrast: 0,
        saturation: 0,
      }),
      [attr]: event.target.valueAsNumber,
    }
  }

  const onChangeSlider = (event: InputEvent, attr: keyof AdjustmentsState): void => {
    event.target.valueAsNumber = source.value?.adjustments.value?.[attr] ?? 0
  }

  return (
    <>
      {() =>
        toValue(showPreviews) === true &&
        sources.value.map((_source, index) => <SourcePreview editor={editor} sourceIndex={index} />)
      }
      <div id="tab-adjust" role="tabpanel" aria-labelledby="tab-button-adjust" class={styles['miru--menu']}>
        {sliders.map((item) =>
          RowSlider({
            label: item.label,
            Icon: item.Icon,
            ticks: [-1, 0, 1],
            zeroPoint: 0,
            value: toRef(() => source.value?.adjustments.value?.[item.key] ?? 0),
            onInput: (event: InputEvent) => onInputSlider(event, item.key),
            onChange: (event: InputEvent) => onChangeSlider(event, item.key),
          }),
        )}
      </div>
    </>
  )
}
