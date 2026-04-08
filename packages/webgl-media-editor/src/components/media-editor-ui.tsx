import { computed, getCurrentScope, ref, type Ref, toRef } from 'fine-jsx'

import { EditorView } from 'shared/types'

import styles from '../css/index.module.css'
import type { MediaEditor } from '../media-editor.ts'

import { AdjustmentsView } from './adjustments.jsx'
import { CropView } from './cropper.jsx'
import { FilterView } from './filter.jsx'

export interface MediaEditorUIProps {
  editor: MediaEditor
  view: Ref<EditorView>
}

/**
 * The UI for an editor instance with filter cropping, filter selection, etc.
 *
 * Used by the Custom Element and Vue component.
 */
export const MediaEditorUI = (props: MediaEditorUIProps) => {
  const { editor, view: currentView } = props

  const { source } = editor
  const effectOfCurrentSource = computed(() => source.value?.effect.value ?? '')
  const scope = getCurrentScope()
  if (scope == null) throw new Error(`[webgl-media-editor] must be run in scope`)

  const hasAdjustment = computed(() => {
    const adjustments = source.value?.adjustments.value
    return adjustments && !!(adjustments.brightness || adjustments.contrast || adjustments.saturation)
  })

  const views: Partial<Record<EditorView, () => JSX.Element>> = {
    [EditorView.Crop]: () => (
      <CropView editor={editor} inactive={toRef(() => currentView.value === EditorView.Crop)} />
    ),
    [EditorView.Adjust]: () => <AdjustmentsView editor={editor} showPreviews />,
    [EditorView.Filter]: () => <FilterView editor={editor} showPreviews />,
  }

  const tabs = [
    {
      view: EditorView.Crop,
      Icon: IconTablerCrop,
      active: () => !!source.value?.crop.value,
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
      active: () => effectOfCurrentSource.value !== '' && (source.value?.intensity.value ?? 0) !== 0,
      label: 'Filter',
    },
  ]

  const mainTabId = ref<number>(0)
  const tabKeyDown = (e: KeyboardEvent): void => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' '].includes(e.key)) return
    else if (e.key === 'ArrowRight') mainTabId.value = (mainTabId.value + 1) % tabs.length
    else if (e.key === 'ArrowLeft') mainTabId.value = (mainTabId.value - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') mainTabId.value = 0
    else if (e.key === 'End') mainTabId.value = tabs.length - 1
    else if (['Enter', ' '].includes(e.key)) {
      currentView.value = tabs[mainTabId.value].view
      setTimeout(() => {
        const panel = document.getElementById(`tab-${currentView.value}`)
        const firstFocusable = panel?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled])',
        )
        firstFocusable?.focus()
      }, 0)
    }
    const tabEls = document.querySelectorAll<HTMLElement>('[role="tab"]')
    tabEls[mainTabId.value].focus()
    e.preventDefault()
  }

  return (
    <div class={styles['miru--main']}>
      {/* VIEWS */}
      <div class={styles['miru--center']} hidden={() => currentView.value !== EditorView.Crop && true}>
        {() => views.crop?.()}
      </div>
      <div class={styles['miru--center']} hidden={() => currentView.value === EditorView.Crop && true}>
        {() => currentView.value !== EditorView.Crop && views[currentView.value]?.()}
      </div>
      {/* MAIN BUTTONS */}
      <p class={styles['miru--menu']}>
        <div class={styles['miru--menu__row']} role="tablist" aria-label="Image Settings">
          {Object.values(tabs).map(({ view, Icon, active, label }) => (
            <button
              role="tab"
              aria-selected={() => currentView.value === view}
              aria-controls={`tab-${view}`}
              tabindex={() => (tabs[mainTabId.value].view === view ? 0 : -1)}
              id={`tab-button-${view}`}
              type="button"
              class={() => [
                styles['miru--button'],
                currentView.value === view && styles['miru--acc'],
                active() && styles['miru--enabled'],
              ]}
              onClick={() => (currentView.value = view)}
              onKeyDown={(e: KeyboardEvent) => tabKeyDown(e)}
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
