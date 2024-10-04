import { Component } from '@/framework/jsx-runtime'

export const RowSlider: Component<Record<string, unknown>> = (props) => {
  return (
    <p class="miru--menu__row">
      <input type="range" step="0.001" class="miru--slider" {...props} />
    </p>
  )
}
