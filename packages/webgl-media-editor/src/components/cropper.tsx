import 'cropperjs/dist/cropper.css'

import type { Component, Ref } from 'fine-jsx'
import { ref, toValue } from 'fine-jsx'

import type { InputEvent } from 'shared/types'

import styles from '../css/index.module.css'
import type { MediaEditor } from '../media-editor.ts'

import { RowSlider } from './row-slider.jsx'
import { useCropt } from './use-cropt.ts'

const ASPECT_9_16 = 0.5625

export const CropView: Component<{ editor: MediaEditor; sourceIndex: number }> = (props) => {
  const editor = toValue(props.editor)
  const { aspectRatio, aspectRatioUnchanged, setAspectRatio, setRotation, container, zoom, setZoom } =
    useCropt({
      editor,
      sourceIndex: toValue(props.sourceIndex),
    })

  const tilt: Ref<'portrait' | 'landscape'> = ref('portrait')

  const ratios = [
    {
      value: ASPECT_9_16,
      // tilt: 'portrait' as const,
      Icon: IconTablerCropLandscape,
      // Icon: IconTablerCropPortrait,
      label: '16:9',
    },
    {
      value: 1,
      Icon: IconTablerCrop_1_1,
      // tilt: 'portrait' as const,
      label: '1:1',
    },
    // {
    //   value: ASPECT_9_16,
    //   // tilt: 'landscape' as const,
    //   Icon: IconTablerCropLandscape,
    //   label: '16:9',
    // },
  ]
  

  // const duplicatedRatio = ratios.find((item) => item.value === originalAspectRatio.value)

  return (
    <>
      <div class={styles['miru--preview']}>{container}</div>
      <div id="tab-crop" role="tabpanel" aria-labelledby="tab-button-crop" class={styles['miru--menu']}>
        <p class={styles['miru--menu__row']}>
          <button
            class={styles['miru--button']}
            type="button"
            onClick={() => {
              tilt.value = tilt.value === 'portrait' ? 'landscape' : 'portrait'
              setAspectRatio(aspectRatio.value, tilt.value)
            }}
            disabled={() => aspectRatio.value === 1 / aspectRatio.value}
          >
            {()=>{
                if(tilt.value === 'portrait'){
                  return  <IconTablerDeviceMobile class={styles['miru--button__icon']} />
                }
                return  <IconTablerDeviceMobileRotated class={styles['miru--button__icon']} />
              }}
            {/* <IconTablerDeviceMobileRotated class={styles['miru--button__icon']} /> */}
            <span class={styles['miru--button__label']}>
              {() => tilt.value[0].toUpperCase() + tilt.value.slice(1)}
            </span>
          </button>

          {/* IF USING FIELDSET INSIDE A ROW, PASS OPTIONS AMOUT FOR PROPER SIZING */}
          <fieldset style="--options-amt:4" role="radiogroup" aria-labelledby="ratio-label">
            <legend id="ratio-label">Aspect Ratio</legend>
            {/* <p class="miru--menu__group"> */}
            <label class={styles['miru--button']}>
              <input
                type="radio"
                name="image-crop"
                value="Original"
                checked={() => aspectRatioUnchanged.value}
                onClick={() => setAspectRatio(-1, tilt.value)}
              />
              <IconTablerCircleOff class={styles['miru--button__icon']} />
              <span class={styles['miru--button__label']}>Original</span>
            </label>

            {ratios.map(({ value, Icon, label }) => (
              <label
                class={styles['miru--button']}
                // disabled={() => (duplicatedRatio?.value === value ? true : null)}
              >
                <input
                  type="radio"
                  name="image-crop"
                  value={label}
                  // checked={() => aspectRatio.value === value}
                  onClick={() => setAspectRatio(value, tilt.value)}
                />
                <Icon class={styles['miru--button__icon']} />
                <span class={styles['miru--button__label']}>{label}</span>
              </label>
            ))}
          </fieldset>

          <button class={styles['miru--button']} type="button" onClick={setRotation}>
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
