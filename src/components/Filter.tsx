import { DEFAULT_INTENSITY, SCROLL_SELECT_EVENT_THROTTLE_MS, SCROLL_SELECT_TIMEOUT_MS } from '@/constants'
import { EffectInternal } from '@/Effect'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { MaybeRefOrGetter, Ref, computed, effect, ref, toRef, toValue, watch } from '@/framework/reactivity'
import { createDisplayContext, getCenter, useElementSize } from '@/utils'
import { throttle } from 'throttle-debounce'
import { RowSlider } from './RowSlider'
import { DisplayContext, InputEvent } from '@/types'
import { ImageSourceState } from '@/engine/ImageSourceState'
import { SourcePreview } from './SourcePreview'

const FilterItem = ({
  source,
  effect,
  index,
  context,
  class: className,
  isActive,
  onClick,
}: {
  source: Ref<ImageSourceState | undefined>
  effect: EffectInternal
  index: number
  context: MaybeRefOrGetter<DisplayContext | undefined>
  class: unknown
  isActive: () => boolean
  onClick: () => void
}) => {
  // render effect preview thumbnails
  watch(
    [effect.isLoading, source, toRef(context), () => source.value?.thumbnailKey.value],
    ([isLoading, source, context]) => {
      if (!isLoading && source && context) source.drawThumbnail(effect, context).catch(() => undefined)
    },
  )

  return (
    <button
      type="button"
      data-index={index}
      class={['miru--button', () => isActive() && 'miru--acc', className]}
      onClick={onClick}
    >
      {() => toValue(context)?.canvas}
      <span class="miru--button__label">{effect.name}</span>
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

  const ORIGINAL_EFFECT: EffectInternal = new EffectInternal(
    { name: 'Original', ops: [] },
    engine.renderer,
    engine.scratchPad2d,
  )

  const onInputIntensity = (event: InputEvent) =>
    source.value && (source.value.intensity.value = event.target.valueAsNumber)

  const contexts = ref<DisplayContext[]>([
    // context for "Original"
    createDisplayContext(),
  ])

  watch([engine.effects], ([effects], _prev) => {
    const newContexts = (contexts.value = contexts.value.slice(0, effects.length + 1))
    effects.forEach((_, index) => (newContexts[index + 1] ??= createDisplayContext()))
  })
  watch([contexts], ([contexts], _prev, onCleanup) => onCleanup(() => (contexts.length = 0)))

  const onScroll = throttle(SCROLL_SELECT_EVENT_THROTTLE_MS, () => {
    const rect = container.value?.getBoundingClientRect()
    if (!rect) return

    const center = getCenter(rect)
    const effectElement = (container.value!.getRootNode() as ShadowRoot | Document)
      .elementFromPoint(center.x, center.y)
      ?.closest<HTMLElement>('[data-index]')

    if (effectElement) scrolledEffectIndex.value = parseInt(effectElement.dataset.index!)
  })

  // scroll to selected filter on mount, on container size change and on source change
  watch([container, useElementSize(container), source], ([container]) => {
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
    <>
      {() =>
        toValue(showPreviews) &&
        engine.sources.value.map((_source, index) => <SourcePreview engine={engine} sourceIndex={index} />)
      }
      <div class="miru--menu">
        <p ref={container} class="miru--menu__row miru--menu__row--scroll" onScroll={onScroll}>
          {() =>
            [ORIGINAL_EFFECT, ...engine.effects.value].map((effect, listIndex) => {
              const effectIndex = listIndex - 1

              return (
                <FilterItem
                  source={source}
                  effect={effect}
                  index={effectIndex}
                  context={() => contexts.value[listIndex]}
                  isActive={() => effectOfCurrentSource.value === effectIndex}
                  onClick={() => onClickFilter(effectIndex)}
                  class={[
                    () => scrolledEffectIndex.value === effectIndex && 'miru--hov',
                    () => ((source.value?.isLoading ?? true) || effect.isLoading.value) && 'miru--loading',
                  ]}
                ></FilterItem>
              )
            })
          }
        </p>

        {RowSlider({
          label: 'Intensity',
          min: 0,
          max: 1,
          value: toRef(() => source.value?.intensity.value ?? 0),
          onInput: onInputIntensity,
          disabled: () => (source.value?.effect.value === -1 ? true : false),
        })}
      </div>

      {/* spacer */}
      <div />
    </>
  )
}
