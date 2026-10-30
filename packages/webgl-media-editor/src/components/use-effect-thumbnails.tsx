import { effect, type MaybeRefOrGetter, ref, type Ref, toValue } from 'fine-jsx'
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
): { canvases: Ref<HTMLCanvasElement[]>; update: (signal?: AbortSignal) => void } => {
  const { renderer } = options
  const ORIGINAL_EFFECT = new Effect({ name: 'Original', ops: [] }, renderer)

  // renderer canvas will contain one row of all thumbnails
  // image data will be sliced onto multiple canvas
  const canvases = ref<HTMLCanvasElement[]>([])

  const createCanvases = () => {
    const length = toValue(options.effects).size + 1
    const prev = canvases.value
    if (prev.length === length) return prev

    const newCanvases = (canvases.value = prev.slice(0, length))
    const { width, height } = toValue(options.thumbnailSize)

    for (let i = newCanvases.length; i < length; i++) {
      const canvas = (newCanvases[i] ??= document.createElement('canvas'))
      canvas.width = width
      canvas.height = height

      canvas.role = 'presentation'
    }

    return newCanvases
  }

  const update = (signal?: AbortSignal): void => {
    const effects = [ORIGINAL_EFFECT, ...toValue(options.effects).values()]
    const { length } = effects
    const { width, height } = toValue(options.thumbnailSize)
    const viewport = { x: 0, y: 0, width, height }

    const canvases = createCanvases()

    if (toValue(options.loading) === true || effects.some((e) => e.isLoading)) return

    const drawOptions = { viewport, width: width * effects.length }
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
    if (signal?.aborted) return

    const rendererCanvas = renderer.canvas

    for (let i = 0; i < length; i++) {
      const canvas = canvases[i]
      const context = canvas.getContext('2d')
      if (!context) continue

      context.drawImage(rendererCanvas, i * width, 0, width, height, 0, 0, width, height)
    }
  }

  effect((onCleanup) => {
    const abort = new AbortController()
    onCleanup(abort.abort.bind(abort))

    renderer.setSourceTexture(
      toValue(options.sourceTexture),
      toValue(options.thumbnailSize),
      toValue(options.sourceSize),
      toValue(options.crop),
    )

    update(abort.signal)
  })

  return { canvases, update }
}
