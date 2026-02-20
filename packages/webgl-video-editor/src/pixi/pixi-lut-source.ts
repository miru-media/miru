import { ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'
import { type EffectOp, LUT_TEX_OPTIONS } from 'webgl-effects'

import type { SyncImageSource } from 'shared/types'
import { get2dContext, getImageData, isSyncSource, loadAsyncImageSource, loadLut } from 'shared/utils'

import { PIXI_HALD_LUT_UPLOADER_ID, PIXI_LUT_UPLOADER_ID } from '../constants.ts'

export class LutUploaderSystem {
  scratchPad2d = get2dContext(undefined, { willReadFrequently: true })

  constructor(renderer: Pixi.WebGLRenderer) {
    const uploads: Record<string, Pixi.GLTextureUploader> = (renderer.texture as any)._uploads
    uploads[PIXI_LUT_UPLOADER_ID] = { id: PIXI_LUT_UPLOADER_ID, upload: this.upload.bind(this, false) }
    uploads[PIXI_HALD_LUT_UPLOADER_ID] = {
      id: PIXI_HALD_LUT_UPLOADER_ID,
      upload: this.upload.bind(this, true),
    }
  }

  // eslint-disable-next-line @typescript-eslint/max-params -- not our API
  upload(
    isHald: boolean,
    source: LutSource,
    glTexture: Pixi.GlTexture,
    gl: Pixi.GlRenderingContext,
    _webGLVersion: number,
    _targetOverride?: number,
    _forceAllocation = false,
  ): void {
    if (!source.resource) return
    loadLut(gl, glTexture.texture, getImageData(source.resource, this.scratchPad2d), isHald, LUT_TEX_OPTIONS)
  }

  static extension: Pixi.ExtensionFormat = {
    type: [Pixi.ExtensionType.WebGLSystem],
    name: 'webgl-video-editor:lut-source',
    ref: LutUploaderSystem,
  }
}

export class LutSource extends Pixi.TextureSource {
  readonly #disposeAbort = new AbortController()
  readonly uploadMethodId: typeof PIXI_LUT_UPLOADER_ID | typeof PIXI_HALD_LUT_UPLOADER_ID
  readonly #isLoading = ref(true)
  resource: SyncImageSource | undefined

  get isLoading(): boolean {
    return this.#isLoading.value
  }

  constructor(sourceOption: EffectOp.Lut['lut']) {
    super({ viewDimension: '3d', format: 'rgba8unorm', minFilter: 'linear', magFilter: 'linear' })

    let source, type: 'lut' | 'hald-lut'

    if (typeof sourceOption === 'string') {
      source = sourceOption
      type = 'lut'
    } else {
      ;({ source, type = 'lut' } = sourceOption)
    }

    this.uploadMethodId = type === 'lut' ? PIXI_LUT_UPLOADER_ID : PIXI_HALD_LUT_UPLOADER_ID

    if (isSyncSource(source)) {
      this.#onLoaded(source)
    } else {
      const { promise, close } = loadAsyncImageSource(source, undefined, false, this.#disposeAbort.signal)
      this.#disposeAbort.signal.addEventListener('abort', close)
      void promise.then(this.#onLoaded.bind(this))
    }
  }

  #onLoaded(source: SyncImageSource) {
    this.resource = source
    this.#isLoading.value = false
    this.update()
  }

  update(): void {
    super.update()
  }

  destroy(): void {
    this.#disposeAbort.abort()
  }
}
