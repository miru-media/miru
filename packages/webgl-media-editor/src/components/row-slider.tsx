import type { Component } from 'fine-jsx'
import { toValue } from 'fine-jsx'

import styles from '../css/index.module.css'

const PERCENTAGE_MULTIPLIER = 100

export const RowSlider: Component<{
  [key: string]: unknown
  value: number
  label: string
  zeroPoint: number
  Icon: () => JSX.Element
  ticks: number[]
}> = ({ label, value, Icon, ticks, zeroPoint, ...inputProps }) => (
  <p class={[styles['miru--menu__row'], styles['miru--menu__slider-row']]}>
    <Icon class={styles['miru--button__icon']} aria-disabled />
    <label id={`row_slider_${toValue(label)}_arialabel`} class={styles['miru--slider-label']}>
      {label}
    </label>
    <input
      type="range"
      step="any"
      class={styles['miru--slider']}
      style={() =>
        `--input-value:${((toValue(value) - toValue(ticks)[0]) / (toValue(ticks)[toValue(ticks).length - 1] - toValue(ticks)[0])) * PERCENTAGE_MULTIPLIER}%`
      }
      {...inputProps}
      zero={() => (toValue(value) === toValue(zeroPoint) ? '' : null)}
      min={toValue(ticks)[0]}
      max={toValue(ticks)[toValue(ticks).length - 1]}
      list={`row_slider_ticks_${toValue(label)}`}
      data-is-centered={toValue(ticks)[0] < 0 ? '' : null}
      value={value}
      role="slider"
      aria-labelledby={`row_slider_${toValue(label)}_arialabel`}
    />
    <datalist id={`row_slider_ticks_${toValue(label)}`}>
      {toValue(ticks).map((tick) => (
        <option value={tick} />
      ))}
    </datalist>
    <div>
      {toValue(ticks)
        .slice(1, -1)
        .map((tick) => {
          const ticksV = toValue(ticks)
          const min = ticksV[0]
          const max = ticksV[ticksV.length - 1]
          return <span style={`left: ${((tick - min) / (max - min)) * PERCENTAGE_MULTIPLIER}%`} tick={tick} />
        })}
    </div>
    <label
      aria-hidden="true"
      class={[
        styles['miru--slider-label'],
        () => toValue(value) !== toValue(zeroPoint) && styles['miru--enabled'],
      ]}
    >
      {() => (toValue(value) === 0 ? 0 : toValue(value).toFixed(2))}
    </label>
  </p>
)
