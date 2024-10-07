import { DEFAULT_INTENSITY, SCROLL_SELECT_EVENT_THROTTLE_MS, SCROLL_SELECT_TIMEOUT_MS } from '@/constants'
import { EffectInternal } from '@/Effect'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { Component } from '@/framework/jsx-runtime'
import {
  MaybeRefOrGetter,
  computed,
  createEffectScope,
  effect,
  ref,
  toRef,
  toValue,
  watch,
} from '@/framework/reactivity'
import { createDisplayContext, getCenter } from '@/utils'
import { throttle } from 'throttle-debounce'
import { RowSlider } from './RowSlider'
import { DisplayContext, InputEvent } from '@/types'
import { ImageSourceState } from '@/engine/ImageSourceState'
import { SourcePreview } from './SourcePreview'

const FilterItem: Component<{
  effect: EffectInternal
  index: number
  context: DisplayContext | undefined
  isActive: () => boolean
  onClick: () => void
}> = ({ effect: filterEffect, index, context, isActive, onClick, children }) => {
  filterEffect = toValue(filterEffect)

  return (
    <button
      type="button"
      data-index={index}
      class={['miru--filter miru--button', () => isActive() && 'miru--acc']}
      onClick={onClick}
    >
      {() => toValue(context)?.canvas}
      {() => (isActive() ? <span class="miru--filter__amount">{children}</span> : '')}
      <span class="miru--filter__name">{filterEffect.name}</span>
    </button>
  )
}

export const FilterView = ({
  engine,
  sourceIndex,
  showPreviews,
}: {
  engine: ImageEditorEngine
  sourceIndex: MaybeRefOrGetter<number>
  showPreviews?: MaybeRefOrGetter<boolean | undefined>
}) => {
  const source = computed((): ImageSourceState | undefined => engine.sources.value[toValue(sourceIndex)])
  const effectOfCurrentSource = toRef(() => source.value?.effect.value ?? -1)

  const container = ref<HTMLElement>()
  const scrolledEffectIndex = ref(-1)

  const onInputIntensity = (event: InputEvent) =>
    source.value && (source.value.intensity.value = event.target.valueAsNumber)

  const contexts = ref<DisplayContext[]>([])

  watch([engine.effects], ([effects], _prev, onCleanup) => {
    const newContexts = (contexts.value = contexts.value.slice(0, effects.length))
    effects.forEach((_, index) => (newContexts[index] ??= createDisplayContext()))

    const watchScope = createEffectScope()
    watchScope.run(() => {
      // render effect preview thumbnails
      watch([source, () => source.value?.thumbnailKey.value, () => engine.isLoadingEffects], ([source]) =>
        engine.drawThumbnails(source, contexts.value),
      )
    })
    onCleanup(() => watchScope.stop())
  })

  const onScroll = throttle(SCROLL_SELECT_EVENT_THROTTLE_MS, () => {
    const rect = container.value?.getBoundingClientRect()
    if (!rect) return

    const center = getCenter(rect)
    const effectElement = (container.value!.getRootNode() as ShadowRoot | Document)
      .elementFromPoint(center.x, center.y)
      ?.closest<HTMLElement>('[data-index]')

    if (effectElement) scrolledEffectIndex.value = parseInt(effectElement.dataset.index!)
  })

  // scroll to selected filter on mount and on source change
  watch([container, source], ([container]) => {
    if (container) onClickFilter(effectOfCurrentSource.value, 'instant')
    onScroll.cancel({ upcomingOnly: true })
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
    const $source = source.value
    if (!$source) return

    $source.effect.value = filterIndex
    $source.intensity.value = DEFAULT_INTENSITY

    scrolledEffectIndex.value = filterIndex
  }

  return (
    // TODO: fragment
    <div class="miru--center">
      {() =>
        toValue(showPreviews) &&
        engine.sources.value.map((_source, index) => <SourcePreview engine={engine} sourceIndex={index} />)
      }
      <div class="miru--menu">
        <p ref={container} class="miru--menu__row miru--menu__row--scroll" onScroll={onScroll}>
          <button
            type="button"
            data-index="-1"
            class={['miru--filter miru--button', () => effectOfCurrentSource.value === -1 && 'miru--acc']}
            onClick={() => onClickFilter(-1)}
          >
            {source.value?.thumbnailCanvas}
            <span class="miru--filter__name">Original</span>
          </button>

          {() =>
            engine.effects.value.map((effect, index) => (
              <FilterItem
                effect={effect}
                index={index}
                context={contexts.value[index]}
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
