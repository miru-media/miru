import type { Component } from 'fine-jsx'
import { toValue } from 'fine-jsx'

import styles from '../css/index.module.css'

export const RowSlider: Component<{
  [key: string]: unknown
  value: number
  label: string
  Icon: () => JSX.Element
  ticks: number[]
}> = ({ label, value, Icon, ticks, ...inputProps }) => (
  <p class={[styles['miru--menu__row'], styles['miru--menu__slider-row']]}>
    <datalist id={`row_slider_ticks_${toValue(label)}`}>
      {toValue(ticks).map((tick) => (
        <option value={tick} />
      ))}
    </datalist>
    <div>
      {toValue(ticks).map((tick) => {
        const ticksV = toValue(ticks)
        const percentageMultiplier = 100
        const min = ticksV[0]
        const max = ticksV[ticksV.length - 1]
        return <span style={`left: ${((tick - min) / (max - min)) * percentageMultiplier}%`} />
      })}
    </div>
    <Icon class={styles['miru--button__icon']} aria-disabled />
    <label id={'row_slider_' + toValue(label) + '_arialabel'} class={styles['miru--slider-label']}>
      {label}
    </label>
    <input
      type="range"
      step="any"
      list={`row_slider_ticks_${toValue(label)}`}
      class={styles['miru--slider']}
      {...inputProps}
      value={value}
      value_current={value}
      role="slider"
      aria-labelledby={'row_slider_' + toValue(label) + '_arialabel'}
    />
    <label class={styles['miru--slider-label']}>
      {() => (toValue(value) === 0 ? 0 : toValue(value).toFixed(2))}
    </label>
  </p>
)
