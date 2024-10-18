import { Component } from '@/framework/jsx-runtime'

export const RowSlider: Component<Record<string, unknown>> = (props) => {
  return (
    <p class="miru--menu__row">
      {/* {props.effect} */}
      {/* i-tabler:arrow-badge-down-filled */}

      <button
        disabled={props.default_value === undefined}
        class="miru--button miru--small"
        onClick={() => alert('onClick function is missing!')}
      >
        {props.default_value !== undefined && (
          <div class="i-tabler:keyframe-align-center miru--button__icon"></div>
        )}
        <label class="miru--button__label">{props.label}</label>
      </button>

      <input type="range" step="0.01" class="miru--slider" {...props} />

      <button class="miru--button miru--small" disabled>
        <label class="miru--button__label">{props.value}</label>
      </button>
    </p>
  )
}
