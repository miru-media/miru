import type { Component } from 'fine-jsx'
import { toValue } from 'fine-jsx'

import styles from '../css/index.module.css'

export const RowSlider: Component<{
  [key: string]: unknown
  value: number
  label: string
}> = ({ label, value, ...inputProps }) => (
  <p class={[styles['miru--menu__row'], styles['miru--menu__slider-row']]}>
    <button class={[styles['miru--button'], styles['miru--small']]} disabled>
      <label class={styles['miru--button__label']}>{label}</label>
    </button>

    <input
      type="range"
      step="any"
      class={styles['miru--slider']}
      {...inputProps}
      value={value}
      value_current={value}
    />

    <button class={[styles['miru--button'], styles['miru--small']]} disabled>
      <label class={styles['miru--button__label']}>
        {() => (toValue(value) !== 0 ? toValue(value).toFixed(2) : 0)}
      </label>
    </button>
  </p>
)
