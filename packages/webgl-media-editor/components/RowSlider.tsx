import { type Component } from 'fine-jsx'
import { toValue } from 'fine-jsx'

export const RowSlider: Component<{
  [key: string]: unknown
  value: number
  label: string
}> = ({ label, value, ...inputProps }) => {
  return (
    <p class="miru--menu__row miru--menu__slider-row">
      <button class="miru--button miru--small" disabled>
        <label class="miru--button__label">{label}</label>
      </button>

      <input
        type="range"
        step="0.01"
        class="miru--slider"
        {...inputProps}
        value={value}
        value_current={value}
      />

      <button class="miru--button miru--small" disabled>
        <label class="miru--button__label">
          {() => (toValue(value) != 0 ? toValue(value).toFixed(2) : 0)}
        </label>
      </button>
    </p>
  )
}
