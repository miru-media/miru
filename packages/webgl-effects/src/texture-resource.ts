import type { ImageSourceObject, SyncImageSource } from 'shared/types'
import { getImageData, isSyncSource, Janitor, loadAsyncImageSource } from 'shared/utils'

import { LUT_TEX_OPTIONS, SOURCE_TEX_OPTIONS } from './constants.ts'
import type { Renderer } from './renderer.ts'

export class TextureResource {
  canvas?: HTMLCanvasElement
  context?: ImageBitmapRenderingContext
  promise?: Promise<never>
  isLoading = false
  error: unknown
  janitor = new Janitor()
  texture: WebGLTexture

  constructor(
    { source, type, crossOrigin }: ImageSourceObject,
    renderer: Renderer,
    onStateChange: (textureResource: TextureResource) => void,
  ) {
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('bitmaprenderer') ?? undefined
    this.texture = renderer.createTexture(
      type === 'lut' || type === 'hald-lut' ? LUT_TEX_OPTIONS : SOURCE_TEX_OPTIONS,
    )

    const onDecoded = (decodedImage: SyncImageSource) => {
      if (type === 'lut' || type === 'hald-lut') {
        const imageData = getImageData(decodedImage, renderer.scratchPad2d)
        renderer.loadLut(this.texture, imageData, type)
      } else {
        renderer.loadImage(this.texture, decodedImage, SOURCE_TEX_OPTIONS)
      }
    }

    if (isSyncSource(source)) onDecoded(source)
    else {
      this.isLoading = true

      const { promise, close } = loadAsyncImageSource(source, crossOrigin, type === 'video')

      promise
        .then(onDecoded)
        .catch((e: unknown) => {
          this.error = e
          onStateChange(this)
        })
        .finally(() => {
          this.isLoading = false
          onStateChange(this)
        })

      this.janitor.add(close)
    }

    this.janitor.add(() => {
      this.context = this.canvas = undefined
      renderer.deleteTexture(this.texture)
    })

    onStateChange(this)
  }

  dispose() {
    this.janitor.dispose()
  }
}
