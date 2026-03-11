import { computed, getCurrentScope, type MaybeRefOrGetter, ref, type Ref, toRef } from 'fine-jsx'

import { EditorView } from 'shared/types'

import styles from '../css/index.module.css'
import type { ImageSourceInternal } from '../image-source-internal.ts'
import type { MediaEditor } from '../media-editor.ts'

import { AdjustmentsView } from './adjustments.jsx'
import { CropView } from './cropper.jsx'
import { FilterView } from './filter.jsx'

export interface MediaEditorUIProps {
  editor: MediaEditor
  view: Ref<EditorView>
  sourceIndex?: MaybeRefOrGetter<number>
}

/**
 * The UI for an editor instance with filter cropping, filter selection, etc.
 *
 * Used by the Custom Element and Vue component.
 */
export const MediaEditorUI = (props: MediaEditorUIProps) => {
  const { editor, view: currentView } = props

  const { sources } = editor
  const currentSourceIndex = toRef(props.sourceIndex ?? ref(0))
  const currentSource = computed(
    (): ImageSourceInternal | undefined => sources.value[currentSourceIndex.value],
  )
  const effectOfCurrentSource = computed(() => currentSource.value?.effect.value ?? -1)
  const scope = getCurrentScope()
  if (scope == null) throw new Error(`[webgl-media-editor] must be run in scope`)

  const hasAdjustment = computed(() => {
    const adjustments = currentSource.value?.adjustments.value
    return adjustments != null && !!(adjustments.brightness || adjustments.contrast || adjustments.saturation)
  })

  const views: Partial<Record<EditorView, () => JSX.Element>> = {
    [EditorView.Crop]: () => <CropView editor={editor} sourceIndex={currentSourceIndex} />,
    [EditorView.Adjust]: () => (
      <AdjustmentsView editor={editor} sourceIndex={currentSourceIndex} showPreviews />
    ),
    [EditorView.Filter]: () => <FilterView editor={editor} sourceIndex={currentSourceIndex} showPreviews />,
  }

  const tabs = [
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
      active: () => effectOfCurrentSource.value !== -1 && (currentSource.value?.intensity.value ?? 0) !== 0,
      label: 'Filter',
    },
  ]

  const tabKeyDown = (e: KeyboardEvent, index: number): void => {
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    if (next !== index) {
      e.preventDefault()
      currentView.value = tabs[next].view
      const el: HTMLElement | null = document.querySelector(`[role="tab"]:nth-of-type(${next + 1})`)
      if (el) el.focus()
    }
  }

  return (
    <div class={styles['miru--main']}>
      {/* VIEWS */}
      <div class={styles['miru--center']}>{() => views[currentView.value]?.()}</div>
      {/* MAIN BUTTONS */}
      <p class={styles['miru--menu']}>
        <div class={styles['miru--menu__row']} role="tablist" aria-label="Image Settings">
          {Object.values(tabs).map(({ view, Icon, active, label }, index) => (
            <button
              role="tab"
              aria-selected={() => currentView.value === view}
              aria-controls={'tab-' + view}
              tabindex={() => (currentView.value === view ? 0 : -1)}
              id={'tab-button-' + view}
              type="button"
              class={() => [
                styles['miru--button'],
                currentView.value === view && styles['miru--acc'],
                active() && styles['miru--enabled'],
              ]}
              onClick={() => (currentView.value = view)}
              onKeyDown={(e: KeyboardEvent) => tabKeyDown(e, index)}
            >
              <Icon class={styles['miru--button__icon']} />
              <span class={styles['miru--button__label']}>{label}</span>
            </button>
          ))}
        </div>
      </p>
    </div>
  )
}
