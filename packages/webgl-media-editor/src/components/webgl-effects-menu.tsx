import {
  computed,
  effect,
  type MaybeRefOrGetter,
  onScopeDispose,
  type Ref,
  ref,
  toRef,
  toValue,
  watch,
} from 'fine-jsx'
import { throttle } from 'throttle-debounce'
import { type CropState, type Renderer, type RendererEffectOp } from 'webgl-effects'

import { Effect } from 'reactive-effects/effect'
import { type InputEvent, type Size } from 'shared/types'
import { getCenter, useElementSize } from 'shared/utils'

import { DEFAULT_INTENSITY, SCROLL_SELECT_EVENT_THROTTLE_MS, SCROLL_SELECT_TIMEOUT_MS } from '../constants'

import { RowSlider } from './row-slider'

const EffectItem = (props: {
  effect: Effect
  id: string | undefined
  imageData: MaybeRefOrGetter<ImageData | undefined>
  thumbnailIndex: MaybeRefOrGetter<number>
  size: MaybeRefOrGetter<Size>
  class: unknown
  isActive: () => boolean
  onClick: () => void
}) => {
  const { id, class: className, isActive, onClick } = props
  const canvas = ref<HTMLCanvasElement>()

  // get data from thumbnail sprite
  effect(() => {
    const context = canvas.value?.getContext('2d')
    const imageData = toValue(props.imageData)
    if (!context || !imageData) return

    const { width, height } = toValue(props.size)
    context.canvas.width = width
    context.canvas.height = height

    const x = toValue(props.thumbnailIndex) * width
    context.putImageData(imageData, -x, 0, x, 0, width, height)
  })

  return (
    <button
      type="button"
      data-id={id}
      class={['miru--button', () => isActive() && 'miru--acc', className]}
      onClick={onClick}
    >
      <canvas ref={canvas} style="transform: scaleY(-1)" />
      <span class="miru--button__label">{props.effect.name}</span>
    </button>
  )
}

export interface WebglEffectsMenuExpose {
  scrollToEffect: (filterId: string | undefined, scrollBehaviour?: ScrollBehavior) => void
}

export const WebglEffectsMenu = (props: {
  ref?: Ref<WebglEffectsMenuExpose | undefined> | ((value: WebglEffectsMenuExpose | undefined) => void)
  sourceTexture: MaybeRefOrGetter<WebGLTexture>
  sourceSize: MaybeRefOrGetter<Size>
  thumbnailSize: MaybeRefOrGetter<Size>
  crop?: MaybeRefOrGetter<CropState | undefined>
  renderer: Renderer
  effects: MaybeRefOrGetter<Map<string, Effect>>
  effect: MaybeRefOrGetter<string | undefined>
  intensity: MaybeRefOrGetter<number>
  prependOps?: MaybeRefOrGetter<RendererEffectOp[]>
  showIntensity?: MaybeRefOrGetter<boolean | undefined>
  loading?: MaybeRefOrGetter<boolean>
  class?: unknown
  onChange: (effectId: string | undefined, intensity: number) => void
}) => {
  const { renderer, showIntensity, onChange } = props
  const currentEffect = computed(() => toValue(props.effect) ?? '')

  const container = ref<HTMLElement>()
  const scrolledEffectId = ref<string>()
  const scrollToEffect = (filterId: string | undefined, scrollBehaviour: ScrollBehavior = 'smooth') => {
    scrolledEffectId.value = filterId
    const filterElement = container.value?.querySelector(`[data-id="${filterId}"]`)
    filterElement?.scrollIntoView({ behavior: scrollBehaviour, inline: 'center', block: 'nearest' })
  }

  if (props.ref) {
    const ref_ = props.ref
    if (typeof ref_ === 'function') ref_({ scrollToEffect })
    else ref_.value = { scrollToEffect }

    onScopeDispose(() => {
      if (typeof ref_ === 'function') ref_(undefined)
      else ref_.value = undefined
    })
  }

  const ORIGINAL_EFFECT = new Effect({ name: 'Original', ops: [] }, renderer)

  const onInputIntensity = (event: InputEvent) => {
    const intensity = event.target.valueAsNumber

    onChange(currentEffect.value, intensity)
  }

  const onScroll = throttle(SCROLL_SELECT_EVENT_THROTTLE_MS, () => {
    const rect = container.value?.getBoundingClientRect()
    if (rect == null) return

    const center = getCenter(rect)
    const effectElement = (container.value!.getRootNode() as ShadowRoot | Document)
      .elementFromPoint(center.x, center.y)
      ?.closest<HTMLElement>('[data-id]')

    if (effectElement == null) return

    const id = effectElement.dataset.id
    scrolledEffectId.value = id ?? ''
  })

  // scroll to selected filter on mount, on container size change and on source change
  watch([container, useElementSize(container), toRef(props.sourceTexture)], ([container]) => {
    if (container != undefined) onClickFilter(currentEffect.value, toValue(props.intensity), 'instant')
    onScroll.cancel({ upcomingOnly: true })
  })

  let scrollTimeoutId: number

  effect((onCleanup) => {
    const scrolledId = scrolledEffectId.value
    if (scrolledId === currentEffect.value) return

    scrollTimeoutId = setTimeout(() => {
      selectFilter(scrolledId, DEFAULT_INTENSITY)
      scrollTimeoutId = 0
    }, SCROLL_SELECT_TIMEOUT_MS) as unknown as number

    onCleanup(() => clearTimeout(scrollTimeoutId))
  })

  // cancel scroll update on effect prop change
  watch([toRef(props.effect)], ([effectId]) => {
    clearTimeout(scrollTimeoutId)
    if (scrolledEffectId.value !== effectId) scrollToEffect(effectId, 'smooth')
  })

  const onClickFilter = (
    filterId: string | undefined,
    intensity = DEFAULT_INTENSITY,
    scrollBehaviour?: ScrollBehavior,
  ) => {
    selectFilter(filterId, intensity)
    scrollToEffect(filterId, scrollBehaviour)
  }

  const selectFilter = (filterId: string | undefined, intensity: number) => {
    onChange(filterId, intensity)
    scrolledEffectId.value = filterId
  }

  // canvas will contain one row of all thumbnails
  const imageData = ref<ImageData>()
  const fb = renderer.createFramebufferAndTexture(toValue(props.thumbnailSize))

  effect(async (onCleanup) => {
    let isStale = false as boolean

    if (toValue(props.loading)) {
      imageData.value = undefined
      return
    }

    onCleanup(() => (isStale = true))

    const { width, height } = toValue(props.thumbnailSize)
    const effects = [ORIGINAL_EFFECT, ...toValue(props.effects).values()]
    const textureSize = { width: width * effects.length, height }

    renderer.resizeTexture(fb.texture, textureSize)
    renderer.setSourceTexture(
      toValue(props.sourceTexture),
      toValue(props.thumbnailSize),
      toValue(props.sourceSize),
      toValue(props.crop),
    )

    const options = {
      framebuffer: fb.framebuffer,
      x: 0,
      y: 0,
      width,
      height,
      clear: true,
    }
    const prependOps = toValue(props.prependOps) ?? []

    for (let i = 0; i < effects.length; i++) {
      renderer.setEffect({ ops: prependOps.concat(effects[i].ops) })
      renderer.setIntensity(1)
      renderer.setIntensity(DEFAULT_INTENSITY)

      options.x = i * width
      renderer.draw(options)
    }

    await renderer.waitAsync()
    if (isStale) return

    imageData.value = await renderer.getImageData(fb.framebuffer, textureSize)
  })

  onScopeDispose(() => {
    renderer.deleteFramebuffer(fb.framebuffer)
    renderer.deleteTexture(fb.texture)
  })

  return (
    <div class={['miru--menu', props.class]}>
      <p ref={container} class="miru--menu__row miru--menu__row--scroll" onScroll={onScroll}>
        {() =>
          [['', ORIGINAL_EFFECT] as const, ...toValue(props.effects)].map(([id, effect], thumbnailIndex) => {
            return (
              <EffectItem
                effect={effect}
                id={id || ''}
                imageData={imageData}
                thumbnailIndex={thumbnailIndex}
                size={props.thumbnailSize}
                isActive={() => currentEffect.value === id}
                onClick={() => onClickFilter(id)}
                class={[
                  () => scrolledEffectId.value === id && 'miru--hov',
                  () =>
                    ((toValue(props.loading) ?? false) || effect.isLoading || !imageData.value) &&
                    'miru--loading',
                ]}
              ></EffectItem>
            )
          })
        }
      </p>

      {() =>
        (toValue(showIntensity) ?? true) &&
        RowSlider({
          label: 'Intensity',
          min: 0,
          max: 1,
          value: toRef(props.intensity),
          onInput: onInputIntensity,
          disabled: () => !currentEffect.value,
        })
      }
    </div>
  )
}
