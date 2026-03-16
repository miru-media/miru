import type { Component } from 'fine-jsx'
import { toValue } from 'fine-jsx'

import styles from '../css/index.module.css'

export const RowSlider: Component<{
  [key: string]: unknown
  value: number
  label: string
  zeroPoint: number
  Icon: () => JSX.Element
  ticks: number[]
}> = ({ label, value, Icon, ticks, zeroPoint, ...inputProps }) => (
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
      class={styles['miru--slider']}
      {...inputProps}
      // value_current={value}
      zero={() => (toValue(value) === toValue(zeroPoint) ? '' : null)}
      min={toValue(ticks)[0]}
      max={toValue(ticks)[toValue(ticks).length - 1]}
      list={`row_slider_ticks_${toValue(label)}`}
      iscentered={toValue(ticks)[0] < 0 ? '' : null}
      value={value}
      role="slider"
      aria-labelledby={'row_slider_' + toValue(label) + '_arialabel'}
    />
    <label class={styles['miru--slider-label']}>
      {() => (toValue(value) !== 0 ? toValue(value).toFixed(2) : 0)}
    </label>
  </p>
)
