import { computed, effect, type MaybeRefOrGetter, ref, type Ref, toValue } from 'fine-jsx'
import type { CropState, Renderer, RendererEffectOp } from 'webgl-effects'

import { Effect } from 'reactive-effects/effect'
import type { Size } from 'shared/types'

import { DEFAULT_INTENSITY } from '../constants.ts'

export interface EffectThumbnailsOptions {
  sourceTexture: MaybeRefOrGetter<WebGLTexture>
  sourceSize: MaybeRefOrGetter<Size>
  thumbnailSize: MaybeRefOrGetter<Size>
  crop?: MaybeRefOrGetter<CropState | undefined>
  renderer: Renderer
  effects: MaybeRefOrGetter<Map<string, Effect>>
  prependOps?: MaybeRefOrGetter<RendererEffectOp[]>
  loading?: MaybeRefOrGetter<boolean>
}

export const useEffectThumbnails = (
  options: EffectThumbnailsOptions,
): { canvases: Ref<HTMLCanvasElement[]>; update: () => void } => {
  const { renderer } = options
  const ORIGINAL_EFFECT = new Effect({ name: 'Original', ops: [] }, renderer)

  // renderer canvas will contain one row of all thumbnails
  // image data will be sliced onto multiple canvas
  const canvases = ref<HTMLCanvasElement[]>([])

  const isLoading = computed(
    () =>
      toValue(options.loading) === true || [...toValue(options.effects).values()].some((e) => e.isLoading),
  )

  const createCanvases = () => {
    const length = toValue(options.effects).size + 1
    const prev = canvases.value
    const { width, height } = toValue(options.thumbnailSize)

    let i = 0
    for (; i < prev.length; i++) {
      const canvas = prev[i]
      canvas.width = width
      canvas.height = height
    }

    if (prev.length === length) return prev

    const newCanvases = (canvases.value = prev.slice(0, length))

    for (; i < length; i++) {
      const canvas = (newCanvases[i] ??= document.createElement('canvas'))
      canvas.width = width
      canvas.height = height

      canvas.role = 'presentation'
    }

    return newCanvases
  }

  const update = (): void => {
    renderer.setSourceTexture(
      toValue(options.sourceTexture),
      toValue(options.thumbnailSize),
      toValue(options.sourceSize),
      toValue(options.crop),
    )

    const effects = [ORIGINAL_EFFECT, ...toValue(options.effects).values()]
    const { length } = effects
    const { width, height } = toValue(options.thumbnailSize)
    const viewport = { x: 0, y: 0, width, height }

    const canvases = createCanvases()

    if (isLoading.value) return

    const drawOptions = { viewport, width: width * effects.length, height }
    const prependOps = toValue(options.prependOps) ?? []

    renderer.clear()

    for (let i = 0; i < length; i++) {
      renderer.setEffect({ ops: prependOps.concat(effects[i].ops) })
      renderer.setIntensity(1)
      renderer.setIntensity(DEFAULT_INTENSITY)

      viewport.x = i * width
      renderer.draw(drawOptions)
    }

    renderer.waitSync()

    const rendererCanvas = renderer.canvas

    for (let i = 0; i < length; i++) {
      const canvas = canvases[i]
      const context = canvas.getContext('2d')
      if (!context) continue

      context.drawImage(rendererCanvas, i * width, 0, width, height, 0, 0, width, height)
    }
  }

  effect((onCleanup) => {
    if (isLoading.value) return

    renderer.setSourceTexture(
      toValue(options.sourceTexture),
      toValue(options.thumbnailSize),
      toValue(options.sourceSize),
      toValue(options.crop),
    )

    const rafHandle = requestAnimationFrame(update)
    onCleanup(() => cancelAnimationFrame(rafHandle))
  })

  return { canvases, update }
}
