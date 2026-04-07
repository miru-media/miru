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
  const { aspectRatio, tilt, setAspectRatio, setTilt, setRotation, container, zoom, rotation, setZoom } =
    useCrop({
      editor,
      sourceIndex: toValue(props.sourceIndex),
    })

  const ratios = [
    {
      value: ASPECT_9_16,
      Icon: IconTablerCropLandscape,
      label: '16:9',
    },
    {
      value: 1,
      Icon: IconTablerCrop_1_1,
      label: '1:1',
    },
  ]

  return (
    <>
      <div class={styles['miru--preview']}>{container}</div>
      <div id="tab-crop" role="tabpanel" aria-labelledby="tab-button-crop" class={styles['miru--menu']}>
        <p class={styles['miru--menu__row']}>
          <button
            class={styles['miru--button']}
            type="button"
            onClick={() => {
              setTilt(tilt.value === 'landscape' ? 'portrait' : 'landscape')
            }}
          >
            {() => {
              if (tilt.value === 'portrait') {
                return <IconTablerDeviceMobile class={styles['miru--button__icon']} />
              }
              return <IconTablerDeviceMobileRotated class={styles['miru--button__icon']} />
            }}
            <span class={styles['miru--button__label']}>
              {() => tilt.value[0].toUpperCase() + tilt.value.slice(1)}
            </span>
          </button>

          {/* IF USING FIELDSET INSIDE A ROW, PASS OPTIONS AMOUT FOR PROPER SIZING */}
          <fieldset style="--options-amt:3" role="radiogroup" aria-labelledby="ratio-label">
            <legend id="ratio-label">Aspect Ratio</legend>
            <label class={styles['miru--button']}>
              <input
                type="radio"
                name="image-crop"
                value="Original"
                checked={() => aspectRatio.value === -1}
                onClick={() => setAspectRatio(-1)}
              />
              <IconTablerCircleOff class={styles['miru--button__icon']} />
              <span class={styles['miru--button__label']}>Original</span>
            </label>

            {ratios.map(({ value, Icon, label }) => (
              <label class={styles['miru--button']}>
                <input
                  type="radio"
                  name="image-crop"
                  value={label}
                  checked={() => aspectRatio.value === value || 1 / aspectRatio.value === value}
                  onClick={() => setAspectRatio(value)}
                />
                <Icon class={styles['miru--button__icon']} />
                <span class={styles['miru--button__label']}>{label}</span>
              </label>
            ))}
          </fieldset>

          <button class={styles['miru--button']} type="button" onClick={setRotation}>
            <IconTablerRotateClockwise class={styles['miru--button__icon']} />
            <span
              class={styles['miru--button__label']}
              aria-label={() => `Rotate, current rotation: ${rotation.value} degrees`}
            >
              Rotate
            </span>
          </button>
        </p>
        <RowSlider
          label="Scale"
          Icon={IconTablerCrop}
          ticks={[1, 2]}
          zeroPoint={1}
          value={zoom}
          onInput={(event: InputEvent) => setZoom(event.target.valueAsNumber)}
        />
      </div>
    </>
  )
}
