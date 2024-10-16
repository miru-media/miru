import { Component } from '@/framework/jsx-runtime'

export const RowSlider: Component<Record<string, unknown>> = (props) => {
  return (
    <p class="miru--menu__row">
      {/* {props.effect} */}
      {/* i-tabler:arrow-badge-down-filled */}
      <div class="miru--slider-reset"></div>
      <span class="miru--slider-label">{props.label}:</span>
      <input type="range" step="0.01" class="miru--slider" {...props} />
      <span class="miru--slider-label">{props.value}</span>
    </p>
  )
}
