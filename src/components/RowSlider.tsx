import { Component } from '@/framework/jsx-runtime'
// import { toValue } from '@/framework/reactivity'

// import { useToggleEdit } from './useToggleEdit'

export const RowSlider: Component<{
  [key: string]: unknown
  value: number
  label: string
  // toggleContext?: ReturnType<typeof useToggleEdit>
}> = ({ label, value, ...inputProps }) => {
  // toggleContext = toValue(toggleContext)
  // const hasToggle = !!toggleContext

  return (
    <p class="miru--menu__row">
      <button class="miru--button miru--small">
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

      <button class="miru--button miru--small">
        <label class="miru--button__label">{value}</label>
      </button>
    </p>
  )
}
