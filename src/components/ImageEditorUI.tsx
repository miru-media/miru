import { MaybeRefOrGetter, Ref, computed, getCurrentScope, ref, toRef } from '@/framework/reactivity'
import { EditorView } from '@/types'

import { ImageEditorEngine } from '../engine/ImageEditorEngine'

import { CropView } from './Cropper'
import { AdjustmentsView } from './Adjustments'
import { FilterView } from './Filter'
import { ImageSourceState } from '@/engine/ImageSourceState'

export interface ImageEditorUIProps {
  engine: ImageEditorEngine
  view: Ref<EditorView>
  sourceIndex?: MaybeRefOrGetter<number>
}

/**
 * The UI for an editor engine instance with filter cropping, filter selection, etc.
 *
 * Used by the Custom Element and Vue component.
 */
export const ImageEditorUI = (props: ImageEditorUIProps) => {
  const { engine, view: currentView } = props

  const { sources } = engine
  const currentSourceIndex = toRef(props.sourceIndex ?? ref(0))
  const currentSource = computed((): ImageSourceState | undefined => sources.value[currentSourceIndex.value])
  const effectOfCurrentSource = computed(() => currentSource.value?.effect.value ?? -1)
  const scope = getCurrentScope()
  if (!scope) throw new Error(`[miru] must be run in scope`)

  const hasAdjustment = computed(() => {
    const adjustments = currentSource.value?.adjustments.value
    return !!adjustments && !!(adjustments.brightness || adjustments.contrast || adjustments.saturation)
  })

  const views: Partial<Record<EditorView, () => JSX.Element>> = {
    [EditorView.Crop]: () => <CropView engine={engine} sourceIndex={currentSourceIndex} />,
    [EditorView.Adjust]: () => (
      <AdjustmentsView engine={engine} sourceIndex={currentSourceIndex} showPreviews />
    ),
    [EditorView.Filter]: () => <FilterView engine={engine} sourceIndex={currentSourceIndex} showPreviews />,
  }

  return (
    <div class="miru--main">
      {/* VIEWS */}
      <div class="miru--center">{() => views[currentView.value]?.()}</div>
      {/* MAIN BUTTONS */}
      <p class="miru--menu">
        <p class="miru--menu__row">
          {[
            {
              view: EditorView.Crop,
              Icon: IconTablerCrop,
              active: () => !!currentSource.value?.crop.value,
              label: 'Crop',
            },
            {
              view: EditorView.Adjust,
              Icon: IconTablerFilters,
              active: () => hasAdjustment.value,
              label: 'Adjust',
            },
            {
              view: EditorView.Filter,
              Icon: IconTablerWand,
              active: () => effectOfCurrentSource.value >= 0,
              label: 'Filter',
            },
          ].map(({ view, Icon, active, label }) => (
            <button
              type="button"
              class={() => [
                'miru--button',
                currentView.value == view && 'miru--acc',
                active() && 'miru--enabled',
              ]}
              onClick={() => (currentView.value = view)}
            >
              <Icon class="miru--button__icon" />
              <span class="miru--button__label">{label}</span>
            </button>
          ))}
        </p>
      </p>
    </div>
  )
}
