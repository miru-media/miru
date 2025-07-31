import type { mat4 } from 'gl-matrix'
import type * as twgl from 'twgl.js'

import type {
  AssetType,
  Context2D,
  CropState,
  EffectDefinition,
  RendererDrawOptions,
  RendererEffect,
  RendererEffectOp,
  Size,
} from './core.ts'

export declare class Effect {
  id?: string
  name: string
  ops: RendererEffectOp[]
  isDisposed: boolean
  isLoading: boolean
  get promise(): Promise<undefined[]> | undefined
  constructor(definition: EffectDefinition, renderer: Renderer, onStateChange?: (effect: Effect) => void)
  toObject(): EffectDefinition
  dispose(): void
}

export declare class Renderer {
  isDisposed: boolean
  effectOps: RendererEffectOp[]
  get canvas(): HTMLCanvasElement | OffscreenCanvas
  scratchPad2d: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  constructor({ gl }?: { gl?: WebGL2RenderingContext })
  createTexture(textureOptions?: twgl.TextureOptions): WebGLTexture
  createFramebufferAndTexture(size?: Size): {
    framebuffer: WebGLFramebuffer
    texture: WebGLTexture
  }
  loadImage(
    texture: WebGLTexture,
    source: TexImageSource,
    textureOptions?: Omit<twgl.TextureOptions, 'width' | 'height'>,
  ): void
  setSourceTexture(
    texture: WebGLTexture,
    resolution: Size,
    textureSize: Size,
    crop?: CropState,
    flipY?: boolean,
    transform?: mat4,
  ): void
  loadLut(texture: WebGLTexture, imageData: ImageData, type?: AssetType.Lut | AssetType.HaldLut): void
  setEffect(effect?: RendererEffect): void
  setIntensity(value: number): void
  resizeTexture(
    texture: WebGLTexture,
    size: Size,
    { target, level, internalFormat, format, type }?: twgl.TextureOptions,
  ): void
  clear(color?: ArrayLike<number>): void
  getProgram(fragmentShader: string): twgl.ProgramInfo
  dropProgram(fragmentShader: string): void
  draw(options?: RendererDrawOptions): void
  waitSync(): void
  waitAsync(intervalMs?: number): Promise<void>
  drawAndTransfer(
    options: RendererDrawOptions & {
      context: Context2D | ImageBitmapRenderingContext
    },
  ): Promise<void>
  getImageData(framebuffer: WebGLFramebuffer, size: Size): Promise<ImageData>
  toBlob(options?: ImageEncodeOptions): Promise<Blob>
  deleteTexture(texture: WebGLTexture): void
  deleteFramebuffer(framebuffer: WebGLFramebuffer): void
  dispose(): void
}
