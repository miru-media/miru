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
  // const hasToggle = !!toggleContext

  return (
    <p class="miru--menu__row">
      <button class="miru--button miru--small">
        {/* {() => toggleContext?.hasValue.value && <IconTablerCircleOff class="miru--button__icon" />} */}
        <label class="miru--button__label">{label}</label>
      </button>

      <input type="range" step="0.01" class="miru--slider" {...inputProps} value={value} />

      <button
        class={() => ['miru--button', 'miru--small', toggleContext?.isToggledOff.value && 'miru--mark-disabled']}
        onClick={toggleContext?.toggle}
      >
        <label class="miru--button__label">{value}</label>
      </button>
    </p>
  )
}
