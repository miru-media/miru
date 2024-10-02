import { Ref, computed, getCurrentScope, ref } from '@/framework/reactivity'
import { EditorView, InputEvent } from '@/types'
import { useElementSize } from '@/utils'

import { ImageEditorEngine } from '../engine/ImageEditorEngine'
import { useCrop } from './useCrop'
import { FilterMenu } from './FilterMenu'
import { render } from '@/framework/jsx-runtime'

import css from 'virtual:shadow.css'

export interface ImageEditorUIProps {
  engine: ImageEditorEngine
  view: Ref<EditorView>
}

export const renderUITo = (node: HTMLElement, props: ImageEditorUIProps) => {
  let root

  if (import.meta.env.NO_SHADOW_ROOT) {
    root = node
  } else {
    root = node.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `${css}`
    root.appendChild(style)
  }

  return render(<ImageEditorUI {...props} />, root)
}

/**
 * The UI for an editor engine instance with filter cropping, filter selection, etc.
 *
 * Used by the Custom Element and Vue component.
 */
export const ImageEditorUI = (props: ImageEditorUIProps) => {
  const { engine, view: currentView } = props

  const { sources, currentSourceIndex, currentSource, effectOfCurrentSource, previewSize } = engine
  const scope = getCurrentScope()
  if (!scope) throw new Error(`[miru] must be run in scope`)

  const previewContainer = ref<HTMLElement>()
  const containerSize = useElementSize(previewContainer)

  scope.effect(() => {
    const size = containerSize.value
    // in the case where the container is hidden or not attached, draw at a fixed size
    const MIN_CONTAINER_SIZE = 200

    previewSize.value = {
      width: Math.max(size.width, MIN_CONTAINER_SIZE),
      height: Math.max(size.height, MIN_CONTAINER_SIZE),
    }
  })

  // draw all sources once when they are all done loading
  scope.watch(
    [() => sources.value.some((s) => s.isLoading || s.janitor.isDisposed)],
    async ([loadingOrDisposed], _prev, onCleanup) => {
      if (loadingOrDisposed) return

      let isStale = false
      onCleanup(() => (isStale = true))

      for (const source of sources.value) {
        if (isStale) return
        await source.drawPreview()
      }
    },
  )

  const {
    container: cropperContainer,
    setAspectRatio,
    resetCrop,
    aspectRatio,
    zoom,
    setZoom,
    cropper,
  } = useCrop(props)

  const onInputIntensity = (event: InputEvent) => {
    const source = currentSource.value
    if (!source) return

    source.intensity.value = event.target.valueAsNumber
  }

  const onAdjustmentIntensity = (event: InputEvent) => {
    const source = currentSource.value!
    if (!source) return

    source.adjustments.value = {
      contrast: 0,
      saturation: 0,
      ...source.adjustments.value,
      brightness: event.target.valueAsNumber,
    }
  }
  const hasAdjustment = computed(() => {
    const adjustments = currentSource.value?.adjustments.value
    return !!adjustments && !!adjustments.brightness
  })

  const onZoomTo = (event: InputEvent) => setZoom(event.target.valueAsNumber)

  const onFileChange = (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return

    // TODO: file input should be outside this component
    engine.sourceInputs.value = [file]
  }

  return (
    <div class="miru--main">
      <div class="miru--center">
        <div
          class="miru--preview"
          style={() => (currentView.value === EditorView.Crop ? 'display:none' : '')}
          ref={previewContainer}
        >
          {() =>
            sources.value.map((s, index) => (
              <div style="display:contents" onClick={() => (currentSourceIndex.value = index)}>
                {s.context.canvas}
              </div>
            ))
          }
        </div>
        {cropperContainer}
      </div>

      <p class="miru--bottom">
        {/* ENHANCEMENT MENU */}
        {() =>
          currentView.value === EditorView.Adjust && (
            <p class="miru--menu__row">
              <button class="miru--button miru--acc" type="button">
                <div class="i-tabler:sun miru--button__icon"></div>
                <label class="miru--button__label">Brightness</label>
              </button>

              <button class="miru--button" type="button">
                <div class="i-tabler:contrast-filled miru--button__icon"></div>
                <label class="miru--button__label">Contrast</label>
              </button>
            </p>
          )
        }

        {/* FILTER MENU */}
        {() => currentView.value === EditorView.Filter && <FilterMenu engine={engine} />}

        {/* CROP MENU */}
        {() =>
          currentView.value === EditorView.Crop && (
            <p class="miru--menu__row">
              <button
                class={['miru--button', () => (aspectRatio.value === -1 ? 'miru--acc' : '')]}
                type="button"
                onClick={resetCrop}
              >
                <div class="i-tabler:frame-off miru--button__icon"></div>
                <label class="miru--button__label">No Crop</label>
              </button>

              {[
                { value: 9 / 16, icon: 'i-tabler:crop-portrait', label: '9/16' },
                { value: 1 / 1, icon: 'i-tabler:crop-1-1', label: '1/1' },
                { value: 16 / 9, icon: 'i-tabler:crop-landscape', label: '16/9' },
              ].map(({ value, icon, label }) => (
                <button
                  class={() => [
                    'miru--button',
                    aspectRatio.value.toFixed(1) === value.toFixed(1) && 'miru--acc',
                  ]}
                  type="button"
                  onClick={() => setAspectRatio(value)}
                >
                  <div class={`${icon} miru--button__icon`}></div>
                  <label class="miru--button__label">{label}</label>
                </button>
              ))}

              <button class="miru--button" type="button" onClick={() => cropper.value?.rotate(90)}>
                <div class="i-tabler:rotate-rectangle miru--button__icon"></div>
                <label class="miru--button__label">Rotate</label>
              </button>
            </p>
          )
        }

        {/* SLIDERS */}
        {[
          { view: EditorView.Crop, props: { min: 0.1, max: 2, value: zoom, onInput: onZoomTo } },
          {
            view: EditorView.Adjust,
            props: {
              min: -1,
              max: 1,
              value: () => currentSource.value?.adjustments.value?.brightness,
              oninput: onAdjustmentIntensity,
            },
          },
          {
            view: EditorView.Filter,
            props: {
              min: 0,
              max: 1,
              value: () => currentSource.value?.intensity.value,
              onInput: onInputIntensity,
              style: () => (currentSource.value?.effect.value === -1 ? 'visibility:hidden' : ''),
            },
          },
        ].map(
          ({ view, props }) =>
            () =>
              currentView.value === view && (
                <p class="miru--menu__row">
                  <input type="range" step="0.001" class="miru--slider" {...props} />
                </p>
              ),
        )}

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
