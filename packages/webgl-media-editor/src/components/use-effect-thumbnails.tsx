import { effect, type MaybeRefOrGetter, onScopeDispose, ref, type Ref, toValue } from 'fine-jsx'
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

export const useEffectThumbnails = (options: EffectThumbnailsOptions): Ref<HTMLCanvasElement[]> => {
  const { renderer } = options
  const ORIGINAL_EFFECT = new Effect({ name: 'Original', ops: [] }, renderer)

  // renderer canvas will contain one row of all thumbnails
  const fb = renderer.createFramebufferAndTexture(toValue(options.thumbnailSize))
  // image data will be sliced onto multiple canvas
  const canvases = ref<HTMLCanvasElement[]>([])

  effect(async (onCleanup) => {
    const effects = [ORIGINAL_EFFECT, ...toValue(options.effects).values()]
    const { length } = effects
    const prevCanvases = canvases.value
    const newCanvases = (canvases.value = prevCanvases.slice(0, length))

    for (let i = newCanvases.length; i < length; i++) {
      const canvas = (newCanvases[i] = document.createElement('canvas'))
      canvas.role = 'presentation'
    }

    if (toValue(options.loading) === true || effects.some((e) => e.isLoading)) return

    let isStale = false as boolean
    onCleanup(() => void (isStale = true))

    const { width, height } = toValue(options.thumbnailSize)
    const textureSize = { width: width * effects.length, height }

    renderer.resizeTexture(fb.texture, textureSize)
    renderer.setSourceTexture(
      toValue(options.sourceTexture),
      toValue(options.thumbnailSize),
      toValue(options.sourceSize),
      toValue(options.crop),
    )

    const drawOptions = {
      framebuffer: fb.framebuffer,
      x: 0,
      y: 0,
      width,
      height,
      clear: true,
    }
    const prependOps = toValue(options.prependOps) ?? []

    for (let i = 0; i < length; i++) {
      renderer.setEffect({ ops: prependOps.concat(effects[i].ops) })
      renderer.setIntensity(1)
      renderer.setIntensity(DEFAULT_INTENSITY)

      drawOptions.x = i * width
      renderer.draw(drawOptions)
    }

    await renderer.waitAsync()
    if (isStale) return

    const imageData = await renderer.getImageData(fb.framebuffer, textureSize)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- may have changed after await
    if (isStale) return

    for (let i = 0; i < length; i++) {
      const canvas = newCanvases[i]
      const context = canvas.getContext('2d')
      if (!context) continue

      canvas.width = width
      canvas.height = height

      const x = toValue(i) * width
      context.putImageData(imageData, -x, 0, x, 0, width, height)
    }

    // eslint-disable-next-line require-atomic-updates -- checked for isStale
    canvases.value = newCanvases
  })

  onScopeDispose(() => {
    renderer.deleteFramebuffer(fb.framebuffer)
    renderer.deleteTexture(fb.texture)
  })

  return canvases
}
