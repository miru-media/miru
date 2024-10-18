import { Component } from '@/framework/jsx-runtime'
import { toValue } from '@/framework/reactivity'
import { useTogleEdit } from './useToggleEdit'

export const RowSlider: Component<{
  [key: string]: unknown
  value: number
  label: string
  toggleContext?: ReturnType<typeof useTogleEdit>
}> = ({ toggleContext, label, value, ...inputProps }) => {
  toggleContext = toValue(toggleContext)
  const hasToggle = !!toggleContext

  return (
    <p class="miru--menu__row">
      {/* {props.effect} */}
      {/* i-tabler:arrow-badge-down-filled */}

      <button disabled={!hasToggle} class="miru--button miru--small" onClick={toggleContext?.toggle}>
        {() => toggleContext?.hasValue.value && <div class="i-tabler:circle-off miru--button__icon"></div>}
        <label class="miru--button__label">{label}</label>
      </button>

      <input type="range" step="0.01" class="miru--slider" {...inputProps} value={value} />

      <button class="miru--button miru--small" disabled>
        <label class="miru--button__label">{value}</label>
      </button>
    </p>
  )
}
