import { ref } from 'fine-jsx'
import { LUT_TEX_OPTIONS, SOURCE_TEX_OPTIONS } from 'webgl-effects'
import { type Renderer } from 'webgl-effects'

import { type ImageSourceObject, type SyncImageSource } from 'shared/types'
import { decodeAsyncImageSource, devSlowDown, getImageData, isSyncSource, Janitor } from 'shared/utils'

export class TextureResource {
  canvas?: HTMLCanvasElement
  context?: ImageBitmapRenderingContext
  promise?: Promise<void>
  isLoading
  error
  janitor = new Janitor()
  texture: WebGLTexture

  constructor({ source, type, crossOrigin }: ImageSourceObject, renderer: Renderer) {
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('bitmaprenderer') ?? undefined
    this.texture = renderer.createTexture(
      type === 'lut' || type === 'hald-lut' ? LUT_TEX_OPTIONS : SOURCE_TEX_OPTIONS,
    )
    this.isLoading = ref(false)
    this.error = ref()

    const onDecoded = (decodedImage: SyncImageSource) => {
      if (type === 'lut' || type === 'hald-lut') {
        const imageData = getImageData(decodedImage, renderer.scratchPad2d)
        renderer.loadLut(this.texture, imageData, type)
      } else {
        renderer.loadImage(this.texture, decodedImage, SOURCE_TEX_OPTIONS)
      }
    }

    if (isSyncSource(source)) {
      if (devSlowDown != undefined)
        devSlowDown()
          .then(() => onDecoded(source))
          .catch(() => undefined)
      else onDecoded(source)
    } else {
      this.isLoading.value = true

      const decode = decodeAsyncImageSource(source, crossOrigin, type === 'video')

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
