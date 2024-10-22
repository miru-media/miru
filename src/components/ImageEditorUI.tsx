import { ImageSourceInternal } from '@/editor/ImageSourceInternal'
import { computed, getCurrentScope, MaybeRefOrGetter, ref, Ref, toRef } from '@/framework/reactivity'
import { EditorView } from '@/types'

import { ImageEditor } from '../editor/ImageEditor'

import { AdjustmentsView } from './Adjustments'
import { CropView } from './Cropper'
import { FilterView } from './Filter'

export interface ImageEditorUIProps {
  editor: ImageEditor
  view: Ref<EditorView>
  sourceIndex?: MaybeRefOrGetter<number>
}

/**
 * The UI for an editor instance with filter cropping, filter selection, etc.
 *
 * Used by the Custom Element and Vue component.
 */
export const ImageEditorUI = (props: ImageEditorUIProps) => {
  const { editor, view: currentView } = props

  const { sources } = editor
  const currentSourceIndex = toRef(props.sourceIndex ?? ref(0))
  const currentSource = computed(
    (): ImageSourceInternal | undefined => sources.value[currentSourceIndex.value],
  )
  const effectOfCurrentSource = computed(() => currentSource.value?.effect.value ?? -1)
  const scope = getCurrentScope()
  if (scope == undefined) throw new Error(`[miru] must be run in scope`)

  const hasAdjustment = computed(() => {
    const adjustments = currentSource.value?.adjustments.value
    return (
      adjustments != undefined && !!(adjustments.brightness || adjustments.contrast || adjustments.saturation)
    )
  })

  const views: Partial<Record<EditorView, () => JSX.Element>> = {
    [EditorView.Crop]: () => <CropView editor={editor} sourceIndex={currentSourceIndex} />,
    [EditorView.Adjust]: () => (
      <AdjustmentsView editor={editor} sourceIndex={currentSourceIndex} showPreviews />
    ),
    [EditorView.Filter]: () => <FilterView editor={editor} sourceIndex={currentSourceIndex} showPreviews />,
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
              active: () => currentSource.value?.crop.value != undefined,
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
              active: () => effectOfCurrentSource.value !== -1  && currentSource.value?.intensity.value,
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
