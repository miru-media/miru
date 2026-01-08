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
  const { aspectRatio, resetCrop, setAspectRatio, rotate, container, zoom, setZoom } = useCrop({
    editor,
    sourceIndex: toValue(props.sourceIndex),
  })

  return (
    <>
      <div class={styles['miru--preview']}>{container}</div>
      <div class={styles['miru--menu']}>
        <p class={styles['miru--menu__row']}>
          <button
            class={[styles['miru--button'], () => (aspectRatio.value === -1 ? styles['miru--acc'] : '')]}
            type="button"
            onClick={async () => {
              await resetCrop()
            }}
          >
            <IconTablerCircleOff class={styles['miru--button__icon']} />
            <span class={styles['miru--button__label']}>Original</span>
          </button>

          {[
            { value: ASPECT_9_16, Icon: IconTablerCropPortrait, label: '9:16' },
            { value: 1, Icon: IconTablerCrop_1_1, label: '1:1' },
            { value: 1 / ASPECT_9_16, Icon: IconTablerCropLandscape, label: '16:9' },
          ].map(({ value, Icon, label }) => (
            <button
              class={() => [
                styles['miru--button'],
                aspectRatio.value.toFixed(1) === value.toFixed(1) && styles['miru--acc'],
              ]}
              type="button"
              onClick={() => setAspectRatio(value)}
            >
              <Icon class={styles['miru--button__icon']} />
              <span class={styles['miru--button__label']}>{label}</span>
            </button>
          ))}

          <button class={styles['miru--button']} type="button" onClick={rotate}>
            <IconTablerRotateClockwise class={styles['miru--button__icon']} />
            <span class={styles['miru--button__label']}>Rotate</span>
          </button>
        </p>

        {RowSlider({
          label: 'Scale',
          min: 0.1,
          max: 2,
          value: zoom,
          onInput: (event: InputEvent) => {
            setZoom(event.target.valueAsNumber)
          },
        })}
      </div>
    </>
  )
}
