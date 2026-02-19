import type { ImageSourceObject, SyncImageSource } from 'shared/types'
import { getImageData, isSyncSource, Janitor, loadAsyncImageSource } from 'shared/utils'

import { LUT_TEX_OPTIONS, SOURCE_TEX_OPTIONS } from './constants.ts'
import type { Renderer } from './renderer.ts'

export class TextureResource {
  promise?: Promise<never>
  isLoading = true
  error: unknown
  janitor = new Janitor()
  texture: WebGLTexture

  constructor(
    { source, type, crossOrigin }: ImageSourceObject,
    renderer: Renderer,
    onStateChange: (textureResource: TextureResource) => void,
  ) {
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

      this.isLoading = false
      onStateChange(this)
    }

    if (isSyncSource(source)) {
      onDecoded(source)
    } else {
      const { promise, close } = loadAsyncImageSource(source, crossOrigin, type === 'video')

      promise.then(onDecoded).catch((e: unknown) => {
        this.error = e
        this.isLoading = false
      })

      this.janitor.add(close)
      onStateChange(this)
    }

    this.janitor.add(() => {
      renderer.deleteTexture(this.texture)
    })
  }

  dispose() {
    this.janitor.dispose()
  }
}
