import { Ref, computed, getCurrentScope } from '@/framework/reactivity'
import { EditorView, InputEvent } from '@/types'

import { ImageEditorEngine } from '../engine/ImageEditorEngine'
import { FilterMenu } from './FilterMenu'

import { SourcePreview } from './SourcePreview'
import { CropView } from './Cropper'
import { AdjustmentsMenu } from './AdjustmentsMenu'

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

  const { sources, currentSource, effectOfCurrentSource } = engine
  const scope = getCurrentScope()
  if (!scope) throw new Error(`[miru] must be run in scope`)

  const hasAdjustment = computed(() => {
    const adjustments = currentSource.value?.adjustments.value
    return !!adjustments && !!adjustments.brightness
  })

  const onFileChange = (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return

    // TODO: file input should be outside this component
    engine.sourceInputs.value = [file]
  }

  return (
    <div class="miru--main">
      <div class="miru--center">
        {() =>
          currentView.value === EditorView.Crop ? (
            <CropView engine={engine} />
          ) : (
            sources.value.map((_source, index) => (
              <SourcePreview
                engine={engine}
                sourceIndex={index}
                style={() => (currentView.value === EditorView.Crop ? 'display:none' : '')}
              />
            ))
          )
        }
      </div>

      <p class="miru--bottom">
        {/* ENHANCEMENT MENU */}
        {() => currentView.value === EditorView.Adjust && <AdjustmentsMenu engine={engine} />}

        {/* FILTER MENU */}
        {() =>
          currentView.value === EditorView.Filter && (
            <FilterMenu engine={engine} sourceIndex={engine.currentSourceIndex} />
          )
        }

        {/* FILESELECT BROWSE */}
        {() =>
          currentView.value === EditorView.Browse && (
            <p class="miru--menu__row">
              <label class="flex miru--button miru--browser">
                <div class="i-tabler:photo-up miru--button__icon"></div>
                {/* Select File */}
                <input
                  class="miru--button miru--button--fileselect"
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                />
              </label>
            </p>
          )
        }

        {/* MAIN BUTTONS */}
        <p class="miru--menu__row">
          {[
            { view: EditorView.Browse, icon: 'i-tabler:photo', active: () => false, label: 'Browse' },
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
