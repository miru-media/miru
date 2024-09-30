import { DEFAULT_INTENSITY, SCROLL_SELECT_EVENT_THROTTLE_MS, SCROLL_SELECT_TIMEOUT_MS } from '@/constants'
import { EffectInternal } from '@/Effect'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { Component } from '@/framework/jsx-runtime'
import { effect, ref, toValue, watch } from '@/framework/reactivity'
import { getCenter } from '@/utils'
import { throttle } from 'throttle-debounce'

const FilterItem: Component<{
  effect: EffectInternal
  index: number
  isActive: () => boolean
  onClick: () => void
}> = ({ effect, index, isActive, onClick, children }) => {
  const { canvas, name } = toValue(effect)

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

export const FilterMenu = ({ engine }: { engine: ImageEditorEngine }) => {
  const { currentSource, effectOfCurrentSource } = engine

  const container = ref<HTMLElement>()
  const scrolledEffectIndex = ref(-1)

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
    const source = currentSource.value
    if (!source) return

    source.effect.value = filterIndex
    source.intensity.value = DEFAULT_INTENSITY

    scrolledEffectIndex.value = filterIndex
  }

  return (
    <p ref={container} class="miru--menu__row miru--menu__row--scroll" onScroll={onScroll}>
      <button
        type="button"
        data-index="-1"
        class={['miru--filter miru--button', () => effectOfCurrentSource.value === -1 && 'miru--acc']}
        onClick={() => onClickFilter(-1)}
      >
        <div class="miru--filter__canvas-container">{currentSource.value?.thumbnailCanvas}</div>
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
            {() => `${Math.round(currentSource.value!.intensity.value * 100)}%`}
          </FilterItem>
        ))
      }
    </p>
  )
}
