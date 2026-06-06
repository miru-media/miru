import {
  computed,
  effect,
  type MaybeRefOrGetter,
  onScopeDispose,
  type Ref,
  ref,
  toRef,
  toValue,
  watch,
} from 'fine-jsx'
import { throttle } from 'throttle-debounce'

import { Effect } from 'reactive-effects/effect'
import type { InputEvent } from 'shared/types'
import { getCenter, useElementSize } from 'shared/utils'

import { DEFAULT_INTENSITY, SCROLL_SELECT_EVENT_THROTTLE_MS, SCROLL_SELECT_TIMEOUT_MS } from '../constants.ts'
import styles from '../css/index.module.css'

import { RowSlider } from './row-slider.jsx'
import { type EffectThumbnailsOptions, useEffectThumbnails } from './use-effect-thumbnails.jsx'

export interface WebglEffectsMenuExpose {
  scrollToEffect: (filterId: string | undefined, scrollBehaviour?: ScrollBehavior) => void
}

export interface WebglEffectsMenuProps extends EffectThumbnailsOptions {
  ref?: Ref<WebglEffectsMenuExpose | undefined> | ((value: WebglEffectsMenuExpose | undefined) => void)
  effect: MaybeRefOrGetter<string | undefined>
  intensity: MaybeRefOrGetter<number>
  showIntensity?: MaybeRefOrGetter<boolean | undefined>
  class?: unknown
  onChange: (effectId: string | undefined, intensity: number) => void
}

const getMenuPropsAndAttrs = (props: WebglEffectsMenuProps & Record<string, unknown>) => {
  const {
    ref,
    sourceTexture,
    sourceSize,
    thumbnailSize,
    crop,
    renderer,
    effects,
    effect,
    intensity,
    prependOps,
    showIntensity,
    loading,
    class: className,
    onChange,
    ...attrs
  } = props

  return {
    props: {
      ref,
      sourceTexture,
      sourceSize,
      thumbnailSize,
      crop,
      renderer,
      effects,
      effect,
      intensity,
      prependOps,
      showIntensity,
      loading,
      class: className,
      onChange,
    },
    attrs,
  }
}

export const WebglEffectsMenu = (props_: WebglEffectsMenuProps & Record<string, unknown>) => {
  const { props, attrs } = getMenuPropsAndAttrs(props_)
  const { renderer, showIntensity, onChange } = props

  const currentEffect = computed(() => toValue(props.effect) ?? '')

  const container = ref<HTMLElement>()
  const scrolledEffectId = ref<string>()
  const scrollToEffect = (filterId: string | undefined, scrollBehaviour: ScrollBehavior = 'smooth') => {
    scrolledEffectId.value = filterId
    const filterElement = container.value?.querySelector(`[data-id="${filterId}"]`)
    filterElement?.scrollIntoView({ behavior: scrollBehaviour, inline: 'center', block: 'nearest' })
  }

  if (props.ref) {
    const ref_ = props.ref
    if (typeof ref_ === 'function') ref_({ scrollToEffect })
    else ref_.value = { scrollToEffect }

    onScopeDispose(() => {
      if (typeof ref_ === 'function') ref_(undefined)
      else ref_.value = undefined
    })
  }

  const ORIGINAL_EFFECT = new Effect({ name: 'Original', ops: [] }, renderer)

  const onInputIntensity = (event: InputEvent) => {
    const intensity = event.target.valueAsNumber

    onChange(currentEffect.value, intensity)
    event.stopPropagation()
  }

  const onScroll = throttle(SCROLL_SELECT_EVENT_THROTTLE_MS, () => {
    const rect = container.value?.getBoundingClientRect()
    if (rect == null) return

    const center = getCenter(rect)
    const effectElement = (container.value!.getRootNode() as ShadowRoot | Document)
      .elementFromPoint(center.x, center.y)
      ?.closest<HTMLElement>('[data-id]')

    if (effectElement == null) return

    const { id } = effectElement.dataset
    scrolledEffectId.value = id ?? ''
  })

  // scroll to selected filter on mount, on container size change and on source change
  watch([container, useElementSize(container), toRef(props.sourceTexture)], ([container]) => {
    if (container) onClickFilter(currentEffect.value, toValue(props.intensity), 'instant')
    onScroll.cancel({ upcomingOnly: true })
  })

  let scrollTimeoutId: number

  effect((onCleanup) => {
    const scrolledId = scrolledEffectId.value
    if (scrolledId === currentEffect.value) return

    scrollTimeoutId = setTimeout(() => {
      selectFilter(scrolledId, DEFAULT_INTENSITY)
      scrollTimeoutId = 0
    }, SCROLL_SELECT_TIMEOUT_MS) as unknown as number

    onCleanup(() => clearTimeout(scrollTimeoutId))
  })

  // cancel scroll update on effect prop change
  watch([toRef(props.effect)], ([effectId]) => {
    clearTimeout(scrollTimeoutId)
    if (scrolledEffectId.value !== effectId) scrollToEffect(effectId, 'smooth')
  })

  const onClickFilter = (
    filterId: string | undefined,
    intensity = DEFAULT_INTENSITY,
    scrollBehaviour?: ScrollBehavior,
  ) => {
    selectFilter(filterId, intensity)
    scrollToEffect(filterId, scrollBehaviour)
  }

  const selectFilter = (filterId: string | undefined, intensity: number) => {
    onChange(filterId, intensity)
    scrolledEffectId.value = filterId
  }

  const canvases = useEffectThumbnails(props)
  const stopPropagaion = (event: Event): void => event.stopPropagation()

  return (
    <div {...attrs} class={[styles['miru--menu'], props.class]}>
      <fieldset
        class={styles['miru--menu__row--scroll']}
        role="radiogroup"
        onInput={stopPropagaion}
        onChange={stopPropagaion}
      >
        <legend>Image Filters</legend>
        <div ref={container} onScroll={onScroll}>
          {() =>
            [['', ORIGINAL_EFFECT] as const, ...toValue(props.effects)].map(
              ([id, effect], thumbnailIndex) => (
                <label
                  data-id={id}
                  class={() => [
                    styles['miru--button'],
                    styles['miru--filter-preview'],
                    scrolledEffectId.value === id && styles['miru--hov'],
                    ((toValue(props.loading) ?? false) ||
                      effect.isLoading ||
                      thumbnailIndex >= canvases.value.length) &&
                      styles['miru--loading'],
                  ]}
                >
                  <input
                    type="radio"
                    name="image-filter"
                    value={effect.name}
                    checked={() => currentEffect.value === id}
                    onClick={() => onClickFilter(id)}
                  />
                  {canvases.value[thumbnailIndex]}
                  <span class={styles['miru--button__label']}>{effect.name}</span>
                </label>
              ),
            )
          }
        </div>
      </fieldset>

      {() =>
        showIntensity !== false && (
          <RowSlider
            label="Intensity"
            Icon={IconTablerCircleOff}
            ticks={[0, 1]}
            zeroPoint={0}
            value={toRef(props.intensity)}
            onInput={onInputIntensity}
            onChange={onInputIntensity}
            disabled={() => !currentEffect.value}
          />
        )
      }
    </div>
  )
}
