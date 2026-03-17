import 'cropperjs/dist/cropper.css'

import type { Component } from 'fine-jsx'
import { toValue } from 'fine-jsx'

import type { InputEvent } from 'shared/types'

import styles from '../css/index.module.css'
import type { MediaEditor } from '../media-editor.ts'

import { RowSlider } from './row-slider.jsx'
import { useCrop } from './use-crop.ts'

const ASPECT_9_16 = 0.5625

export const CropView: Component<{ editor: MediaEditor; sourceIndex: number }> = (props) => {
  const editor = toValue(props.editor)
  const { aspectRatio, originalAspectRatio, resetCrop, setAspectRatio, rotate, container, zoom, setZoom } =
    useCrop({
      editor,
      sourceIndex: toValue(props.sourceIndex),
    })

  const ratios = [
    { value: ASPECT_9_16, Icon: IconTablerCropPortrait, label: '9:16' },
    { value: 1, Icon: IconTablerCrop_1_1, label: '1:1' },
    { value: 1 / ASPECT_9_16, Icon: IconTablerCropLandscape, label: '16:9' },
  ]

  const duplicatedRatio = ratios.find((item) => item.value === originalAspectRatio.value)

  return (
    <>
      <div class={styles['miru--preview']}>{container}</div>
      <div id="tab-crop" role="tabpanel" aria-labelledby="tab-button-crop" class={styles['miru--menu']}>
        <p class={styles['miru--menu__row']}>
          {/* IF USING FIELDSET INSIDE A ROW, PASS OPTIONS AMOUT FOR PROPER SIZING */}
          <fieldset style="--options-amt:4" role="radiogroup" aria-labelledby="ratio-label">
            <legend id="ratio-label">Aspect Ratio</legend>
            {/* <p class="miru--menu__group"> */}
            <label class={styles['miru--button']}>
              <input
                type="radio"
                name="image-crop"
                value="Original"
                checked={() => !aspectRatio.value}
                onClick={async () => {
                  await resetCrop()
                }}
              />
              <IconTablerCircleOff class={styles['miru--button__icon']} />
              <span class={styles['miru--button__label']}>Original</span>
            </label>

            {ratios.map(({ value, Icon, label }) => (
              <label
                class={styles['miru--button']}
                disabled={() => (duplicatedRatio?.value === value ? true : null)}
              >
                <input
                  type="radio"
                  name="image-crop"
                  value={label}
                  checked={() =>
                    duplicatedRatio?.value !== value && aspectRatio.value.toFixed(1) === value.toFixed(1)
                  }
                  onClick={() => setAspectRatio(value)}
                />
                <Icon class={styles['miru--button__icon']} />
                <span class={styles['miru--button__label']}>{label}</span>
              </label>
            ))}
          </fieldset>

          <button class={styles['miru--button']} type="button" onClick={rotate}>
            <IconTablerRotateClockwise class={styles['miru--button__icon']} />
            <span class={styles['miru--button__label']}>Rotate</span>
          </button>
        </p>
        <RowSlider
          label="Scale"
          Icon={IconTablerCrop}
          ticks={[1 / 10, 1 / 2, 1, 2]}
          zeroPoint={1}
          value={zoom}
          onInput={(event: InputEvent) => setZoom(event.target.valueAsNumber)}
        />
      </div>
    </>
  )
}
