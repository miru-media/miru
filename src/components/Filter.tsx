import { DEFAULT_INTENSITY, SCROLL_SELECT_EVENT_THROTTLE_MS, SCROLL_SELECT_TIMEOUT_MS } from '@/constants'
import { EffectInternal } from '@/Effect'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { Component } from '@/framework/jsx-runtime'
import {
  MaybeRefOrGetter,
  computed,
  effect,
  onScopeDispose,
  ref,
  toValue,
  watch,
} from '@/framework/reactivity'
import { getCenter } from '@/utils'
import { throttle } from 'throttle-debounce'
import { RowSlider } from './RowSlider'
import { InputEvent } from '@/types'
import { ImageSourceState } from '@/engine/ImageSourceState'
import { SourcePreview } from './SourcePreview'

const FilterItem: Component<{
  effect: EffectInternal
  index: number
  isActive: () => boolean
  onClick: () => void
}> = ({ effect, index, isActive, onClick, children }) => {
  effect = toValue(effect)
  const { canvas, name } = effect

  return (
    <button
      type="button"
      data-index={index}
      class={['miru--filter miru--button', () => isActive() && 'miru--acc']}
      onClick={onClick}
    >
      <div class="miru--filter__canvas-container">{canvas}</div>
      {() => (isActive() ? <span class="miru--filter__amount">{children}</span> : '')}
      <span class="miru--filter__name">{name}</span>
    </button>
  )
}

export const FilterView = ({
  engine,
  sourceIndex,
}: {
  engine: ImageEditorEngine
  sourceIndex: MaybeRefOrGetter<number>
}) => {
  const { sources, effectOfCurrentSource } = engine
  const source = computed((): ImageSourceState | undefined => engine.sources.value[toValue(sourceIndex)])

  const container = ref<HTMLElement>()
  const scrolledEffectIndex = ref(-1)

  const onInputIntensity = (event: InputEvent) => {
    if (!source.value) return

    source.value.intensity.value = event.target.valueAsNumber
  }

  // scroll to selected filter on mount
  watch([container], ([container]) => container && onClickFilter(effectOfCurrentSource.value, 'instant'))

  const onScroll = throttle(SCROLL_SELECT_EVENT_THROTTLE_MS, () => {
    const rect = container.value?.getBoundingClientRect()
    if (!rect) return

    const center = getCenter(rect)
    const effectElement = (container.value!.getRootNode() as ShadowRoot | Document)
      .elementFromPoint(center.x, center.y)
      ?.closest<HTMLElement>('[data-index]')

    if (effectElement) scrolledEffectIndex.value = parseInt(effectElement.dataset.index!)
  })

  onScopeDispose(() => onScroll.cancel())

  effect((onCleanup) => {
    const scrolledIndex = scrolledEffectIndex.value
    if (scrolledIndex === effectOfCurrentSource.value) return

    const handle = setTimeout(() => selectFilter(scrolledIndex), SCROLL_SELECT_TIMEOUT_MS)
    onCleanup(() => clearTimeout(handle))
  })

  const onClickFilter = (filterIndex: number, scrollBehaviour: ScrollBehavior = 'smooth') => {
    selectFilter(filterIndex)
    container.value
      ?.querySelector(`[data-index="${filterIndex}"]`)
      ?.scrollIntoView({ behavior: scrollBehaviour, inline: 'center', block: 'nearest' })
  }

  const selectFilter = (filterIndex: number) => {
    const $source = source.value
    if (!$source) return

    $source.effect.value = filterIndex
    $source.intensity.value = DEFAULT_INTENSITY

    scrolledEffectIndex.value = filterIndex
  }

  return (
    // TODO: fragment
    <div class="miru--center">
      {() => {
        return sources.value.map((_source, index) => <SourcePreview engine={engine} sourceIndex={index} />)
      }}
      <div class="miru--menu">
        <p ref={container} class="miru--menu__row miru--menu__row--scroll" onScroll={onScroll}>
          <button
            type="button"
            data-index="-1"
            class={['miru--filter miru--button', () => effectOfCurrentSource.value === -1 && 'miru--acc']}
            onClick={() => onClickFilter(-1)}
          >
            <div class="miru--filter__canvas-container">{source.value?.thumbnailCanvas}</div>
            <span class="miru--filter__name">Original</span>
          </button>

          {() =>
            engine.effects.value.map((effect, index) => (
              <FilterItem
                effect={effect}
                index={index}
                isActive={() => effectOfCurrentSource.value === index}
                onClick={() => onClickFilter(index)}
              >
                {() => `${Math.round(source.value!.intensity.value * 100)}%`}
              </FilterItem>
            ))
          }
        </p>

        {RowSlider({
          min: 0,
          max: 1,
          value: () => source.value?.intensity.value,
          onInput: onInputIntensity,
          style: () => (source.value?.effect.value === -1 ? 'visibility:hidden' : ''),
        })}
      </div>

      {/* spacer */}
      <div />
    </div>
  )
}
