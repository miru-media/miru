import { Component } from '@/framework/jsx-runtime'

export const RowSlider: Component<Record<string, unknown>> = (props) => {
  return (
    <p class="miru--menu__row">
      {/* {props.effect} */}
      <span class="miru--slider-label">
        {props.label}: {props.value}%
      </span>
      <input type="range" step="0.01" class="miru--slider" {...props} />
    </p>
  )
}
