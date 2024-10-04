import { Ref, computed, getCurrentScope } from '@/framework/reactivity'
import { EditorView, InputEvent } from '@/types'

import { ImageEditorEngine } from '../engine/ImageEditorEngine'

import { CropView } from './Cropper'
import { AdjustmentsView } from './Adjustments'
import { FilterView } from './Filter'

export interface ImageEditorUIProps {
  engine: ImageEditorEngine
  view: Ref<EditorView>
}

/**
 * The UI for an editor engine instance with filter cropping, filter selection, etc.
 *
 * Used by the Custom Element and Vue component.
 */
export const ImageEditorUI = (props: ImageEditorUIProps) => {
  const { engine, view: currentView } = props

  const { currentSource, effectOfCurrentSource } = engine
  const scope = getCurrentScope()
  if (!scope) throw new Error(`[miru] must be run in scope`)

  const hasAdjustment = computed(() => {
    const adjustments = currentSource.value?.adjustments.value
    return !!adjustments && !!adjustments.brightness
  })

  // const onFileChange = (event: InputEvent) => {
  //   const file = event.target.files?.[0]
  //   if (!file) return

  //   // TODO: file input should be outside this component
  //   engine.sourceInputs.value = [file]
  // }

  const views: Partial<Record<EditorView, () => JSX.Element>> = {
    [EditorView.Crop]: () => <CropView engine={engine} />,
    [EditorView.Adjust]: () => <AdjustmentsView engine={engine} />,
    [EditorView.Filter]: () => <FilterView engine={engine} sourceIndex={engine.currentSourceIndex} />,
  }

  return (
    <div class="miru--main">
      {/* VIEWS */}
      {() => views[currentView.value]?.()}
      {/* MAIN BUTTONS */}
      <p class="miru--menu">
        <p class="miru--menu__row">
          {[
            {
              view: EditorView.Crop,
              icon: 'i-tabler:crop',
              active: () => !!currentSource.value?.crop.value,
              label: 'Crop',
            },
            {
              view: EditorView.Adjust,
              icon: 'i-tabler:filters',
              active: () => hasAdjustment.value,
              label: 'Adjust',
            },
            {
              view: EditorView.Filter,
              icon: 'i-tabler:sparkles',
              active: () => effectOfCurrentSource.value >= 0,
              label: 'Filter',
            },
          ].map(({ view, icon, active, label }) => (
            <button
              type="button"
              class={() => [
                'miru--button',
                currentView.value == view && 'miru--acc',
                active() && 'miru--button--active',
              ]}
              onClick={() => (currentView.value = view)}
            >
              <div class={`${icon} miru--button__icon`}></div>
              <label class="miru--button__label">{label}</label>
            </button>
          ))}
        </p>
      </p>
    </div>
  )
}
