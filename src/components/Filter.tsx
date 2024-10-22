import { throttle } from 'throttle-debounce'

import { DEFAULT_INTENSITY, SCROLL_SELECT_EVENT_THROTTLE_MS, SCROLL_SELECT_TIMEOUT_MS } from '@/constants'
import { ImageEditor } from '@/editor/ImageEditor'
import { ImageSourceInternal } from '@/editor/ImageSourceState'
import { EffectInternal } from '@/Effect'
import { computed, effect, MaybeRefOrGetter, ref, Ref, toRef, toValue, watch } from '@/framework/reactivity'
import { DisplayContext, InputEvent } from '@/types'
import { createDisplayContext, getCenter, useElementSize } from '@/utils'

import { RowSlider } from './RowSlider'
import { SourcePreview } from './SourcePreview'
import { useTogleEdit } from './useToggleEdit'

const FilterItem = ({
  source,
  effect,
  index,
  context,
  class: className,
  isActive,
  onClick,
}: {
  source: Ref<ImageSourceInternal | undefined>
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
  editor,
  sourceIndex,
  showPreviews,
}: {
  editor: ImageEditor
  sourceIndex: MaybeRefOrGetter<number>
  showPreviews?: MaybeRefOrGetter<boolean | undefined>
}) => {
  const source = computed((): ImageSourceInternal | undefined => editor.sources.value[toValue(sourceIndex)])
  const effectOfCurrentSource = toRef(() => source.value?.effect.value ?? -1)

  const container = ref<HTMLElement>()
  const scrolledEffectIndex = ref(-1)

  const ORIGINAL_EFFECT: EffectInternal = new EffectInternal(
    { name: 'Original', ops: [] },
    editor.renderer,
    editor.scratchPad2d,
  )

  const toggleContext = useTogleEdit(source, 'intensity')

  const onInputIntensity = (event: InputEvent) => {
    if (!source.value) return

    toggleContext.clearSavedValue()
    source.value.intensity.value = event.target.valueAsNumber
  }

  const contexts = ref<DisplayContext[]>([
    // context for "Original"
    createDisplayContext(),
  ])

  watch([editor.effects], ([effects], _prev) => {
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
        editor.sources.value.map((_source, index) => <SourcePreview editor={editor} sourceIndex={index} />)
      }
      <div class="miru--menu">
        <p ref={container} class="miru--menu__row miru--menu__row--scroll" onScroll={onScroll}>
          {() =>
            [ORIGINAL_EFFECT, ...editor.effects.value].map((effect, listIndex) => {
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
          toggleContext
        })}
      </div>

      {/* spacer */}
      <div />
    </>
  )
}
