import { Component } from '@/framework/jsx-runtime'

export const RowSlider: Component<{
  [key: string]: unknown
  value: number
  label: string
}> = ({ label, value, ...inputProps }) => {
  return (
    <p class="miru--menu__row">
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
        <label class="miru--button__label">{value}</label>
      </button>
    </p>
  )
}
