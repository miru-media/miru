import { ref } from '@/framework/reactivity'

import { LUT_TEX_OPTIONS, SOURCE_TEX_OPTIONS } from './constants'
import { Renderer } from './renderer/Renderer'
import { AssetType, ImageSourceObject, SyncImageSource } from './types'
import { decodeAsyncImageSource, devSlowDown, getImageData, isSyncSource, Janitor } from './utils'

export class TextureResource {
  canvas?: HTMLCanvasElement
  context?: ImageBitmapRenderingContext
  promise?: Promise<void>
  isLoading
  error
  janitor = new Janitor()
  texture: WebGLTexture

  constructor(
    { source, type, crossOrigin }: ImageSourceObject,
    renderer: Renderer,
    scratchpad: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ) {
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('bitmaprenderer') ?? undefined
    this.texture = renderer.createTexture(
      type === AssetType.Lut || type === AssetType.HaldLut ? LUT_TEX_OPTIONS : SOURCE_TEX_OPTIONS,
    )
    this.isLoading = ref(false)
    this.error = ref()

    const onDecoded = (decodedImage: SyncImageSource) => {
      if (type === AssetType.Lut || type === AssetType.HaldLut) {
        const imageData = getImageData(decodedImage, scratchpad)
        renderer.loadLut(this.texture, imageData, type)
      } else {
        renderer.loadImage(this.texture, decodedImage, SOURCE_TEX_OPTIONS)
      }
    }

    if (isSyncSource(source)) {
      if (devSlowDown)
        devSlowDown()
          .then(() => onDecoded(source))
          .catch(() => undefined)
      else onDecoded(source)
    } else {
      this.isLoading.value = true

      const decode = decodeAsyncImageSource(source, crossOrigin, type === AssetType.Video)

      decode.promise
        .then(onDecoded)
        .catch((e: unknown) => (this.error.value = e))
        .finally(() => (this.isLoading.value = false))

      this.janitor.add(decode.close)
    }

    this.janitor.add(() => {
      this.context = this.canvas = undefined
      renderer.deleteTexture(this.texture)
    })
  }
}
