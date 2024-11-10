import { mat4 } from 'gl-matrix'
import * as twgl from 'twgl.js'

import { EffectOpType, LUT_TEX_OPTIONS, MAX_EFFECT_OPS, SOURCE_TEX_OPTIONS } from '@/constants'
import * as GL from '@/GL'
import {
  type AdjustmentsState,
  AssetType,
  type Context2D,
  type CropState,
  type RendererEffect,
  type RendererEffectOp,
  type Size,
  type SyncImageSource,
} from '@/types'
import { canvasToBlob, get2dContext, getWebgl2Context, isOffscreenCanvas, setObjectSize } from '@/utils'

import fs from './glsl/main.frag'
import vs from './glsl/main.vert'

export interface RendererOptions {
  gl?: WebGL2RenderingContext
  canvas?: HTMLCanvasElement | OffscreenCanvas
}

const setTextureParameters = (
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  options: twgl.TextureOptions,
) => {
  twgl.setTextureParameters(gl, texture, options)
  gl.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, options.colorspaceConversion ?? false)
  gl.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, options.premultiplyAlpha ?? false)
  gl.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, options.flipY ?? false)
}

export class Renderer {
  #gl: WebGL2RenderingContext
  #programInfo: twgl.ProgramInfo
  #uniforms = {
    u_flipY: true,
    u_resolution: [1, 1],
    u_image: null as WebGLTexture | null,
    u_size: [1, 1],
    u_intensity: 1,
    u_images: [] as WebGLTexture[],
    u_luts: [] as WebGLTexture[],
    u_operations: [] as RendererEffectOp[],
    u_adjustments: null as AdjustmentsState | null,
    u_matrix: mat4.create(),
    u_textureMatrix: mat4.create(),
  }
  #vertexBuffers: WebGLBuffer[] = []
  emptyTexture: WebGLTexture
  emptyTexture3D: WebGLTexture
  isDisposed = false

  #emptyAdjustments: AdjustmentsState = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
  }

  get canvas() {
    return this.#gl.canvas
  }
  scratchPad2d = get2dContext(undefined, { willReadFrequently: true })

  constructor({ gl = getWebgl2Context() } = {}) {
    this.#gl = gl

    this.#programInfo = twgl.createProgramInfo(gl, [vs, fs])

    const unitQuad = new Float32Array([1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0])

    ;[
      { name: 'a_position', data: unitQuad },
      { name: 'a_texCoord', data: unitQuad },
    ].forEach(({ name, data }) => {
      const location = gl.getAttribLocation(this.#programInfo.program, name)
      const buffer = gl.createBuffer()!

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(location)
      this.#vertexBuffers.push(buffer)
    })

    this.emptyTexture = this.createTexture()
    this.emptyTexture3D = this.createTexture(LUT_TEX_OPTIONS)
  }

  createTexture(textureOptions: twgl.TextureOptions = SOURCE_TEX_OPTIONS) {
    const gl = this.#gl
    const {
      target = GL.TEXTURE_2D,
      internalFormat = GL.RGBA8,
      format = GL.RGBA,
      type = GL.UNSIGNED_BYTE,
    } = textureOptions

    const texture = gl.createTexture()
    if (texture == undefined) throw new Error(`[miru] gl.createTexture() failed`)

    twgl.setTextureParameters(gl, texture, textureOptions)

    const data = new ImageData(new Uint8ClampedArray(4), 1)

    if (target === GL.TEXTURE_2D) gl.texImage2D(target, 0, internalFormat, 1, 1, 0, format, type, data)
    else gl.texImage3D(target, 0, internalFormat, 1, 1, 1, 0, format, type, data)

    return texture
  }

  loadImage(
    texture: WebGLTexture,
    source: SyncImageSource,
    textureOptions: Omit<twgl.TextureOptions, 'width' | 'height'> = SOURCE_TEX_OPTIONS,
  ) {
    const gl = this.#gl
    const { internalFormat = GL.RGBA, format = GL.RGBA, type = GL.UNSIGNED_BYTE } = textureOptions

    setTextureParameters(gl, texture, textureOptions)

    this.#gl.texImage2D(GL.TEXTURE_2D, 0, internalFormat, format, type, source)
    if (textureOptions.auto === true) this.#gl.generateMipmap(GL.TEXTURE_2D)
  }

  setSourceTexture(
    texture: WebGLTexture,
    resolution: Size,
    textureSize: Size,
    crop?: CropState,
    flipY = false,
  ) {
    crop ??= { x: 0, y: 0, width: textureSize.width, height: textureSize.height, rotate: 0 }

    this.#uniforms.u_flipY = flipY
    this.#uniforms.u_image = texture
    this.#uniforms.u_size = [crop.width, crop.height]

    {
      const { width, height } = resolution
      this.#uniforms.u_resolution = [width, height]
      const { u_matrix } = this.#uniforms
      mat4.ortho(u_matrix, 0, width, height, 0, -1, 1)
      mat4.scale(u_matrix, u_matrix, [width, height, 1])
    }

    {
      const { width, height } = textureSize
      const tm = this.#uniforms.u_textureMatrix

      mat4.fromScaling(tm, [1 / width, 1 / height, 1])
      mat4.translate(tm, tm, [crop.x, crop.y, 0])

      mat4.scale(tm, tm, [crop.width, crop.height, 1])
    }

    const { canvas } = this.#gl

    canvas.width = resolution.width
    canvas.height = resolution.height
  }

  loadLut(texture: WebGLTexture, imageData: ImageData, type?: AssetType.Lut | AssetType.HaldLut) {
    const isHald = type === AssetType.HaldLut
    this.#loadLut(texture, imageData, isHald)
  }

  #loadLut(texture: WebGLTexture, imageData: ImageData | undefined, isHald: boolean) {
    const gl = this.#gl

    if (imageData == undefined) return

    const format = GL.RGBA
    const type = GL.UNSIGNED_BYTE

    const { width, height } = imageData
    const size = Math.cbrt(width * height)
    const slicesPerRow = width / size

    setTextureParameters(gl, texture, LUT_TEX_OPTIONS)

    if (isHald || width === 1 || height === 1) {
      gl.texImage3D(GL.TEXTURE_3D, 0, format, size, size, size, 0, format, type, imageData.data)
      return
    }

    gl.pixelStorei(GL.UNPACK_ALIGNMENT, 4)
    gl.pixelStorei(GL.UNPACK_ROW_LENGTH, width)
    gl.pixelStorei(GL.UNPACK_IMAGE_HEIGHT, height)
    gl.texStorage3D(GL.TEXTURE_3D, 1, GL.RGBA8, size, size, size)

    const pixelBuffer = gl.createBuffer()
    gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, pixelBuffer)
    gl.bufferData(GL.PIXEL_UNPACK_BUFFER, imageData.data, GL.STREAM_DRAW)

    for (let z = 0; z < size; z++) {
      const skipX = (z % slicesPerRow) * size
      const skipY = Math.floor(z / slicesPerRow) * size

      gl.pixelStorei(GL.UNPACK_SKIP_PIXELS, skipX)
      gl.pixelStorei(GL.UNPACK_SKIP_ROWS, skipY)
      gl.texSubImage3D(GL.TEXTURE_3D, 0, 0, 0, z, size, size, 1, format, type, 0)
    }

    gl.pixelStorei(GL.UNPACK_ALIGNMENT, 4)
    gl.pixelStorei(GL.UNPACK_ROW_LENGTH, 0)
    gl.pixelStorei(GL.UNPACK_IMAGE_HEIGHT, 0)
    gl.pixelStorei(GL.UNPACK_SKIP_PIXELS, 0)
    gl.pixelStorei(GL.UNPACK_SKIP_ROWS, 0)

    // gl.deleteBuffer(pixelBuffer)
    gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, null)
  }

  setEffect(effect?: RendererEffect) {
    const { images, luts, ops } = effect ?? { images: [], luts: [], ops: [] }

    if (ops.length > MAX_EFFECT_OPS)
      throw new Error(`[miru] ${ops.length} exeeds the maximum of ${MAX_EFFECT_OPS}`)

    this.#uniforms.u_operations.length = 0

    const paddedOps = []
    const noop: RendererEffectOp = {
      type: EffectOpType.NOOP,
      image: 0,
      lut: 0,
      intensity: 0,
    }

    for (let i = 0; i < MAX_EFFECT_OPS; i++) paddedOps[i] = ops[i] ?? noop

    this.#uniforms.u_images = images
    this.#uniforms.u_luts = luts
    this.#uniforms.u_operations = paddedOps
  }

  setIntensity(value: number) {
    this.#uniforms.u_intensity = value
  }

  setAdjustments(value = this.#emptyAdjustments) {
    this.#uniforms.u_adjustments = value
  }

  clear() {
    this.#gl.clear(GL.COLOR_BUFFER_BIT)
  }

  draw() {
    const gl = this.#gl

    gl.useProgram(this.#programInfo.program)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.clearColor(0, 0, 0, 1)
    gl.enable(GL.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    twgl.setUniforms(this.#programInfo, this.#uniforms)

    gl.drawArrays(GL.TRIANGLES, 0, 6)

    const sync = gl.fenceSync(GL.SYNC_GPU_COMMANDS_COMPLETE, 0)

    if (sync == null) return
    if (gl.getSyncParameter(sync, GL.SYNC_STATUS) !== GL.SIGNALED) gl.clientWaitSync(sync, 0, 0)
    gl.deleteSync(sync)
  }

  async drawAndTransfer(context: ImageBitmapRenderingContext | Context2D) {
    this.draw()

    const { canvas } = context
    setObjectSize(canvas, this.#gl.canvas)

    if (context instanceof ImageBitmapRenderingContext) {
      const bitmapOrPromise = this.toImageBitmap()
      context.transferFromImageBitmap('then' in bitmapOrPromise ? await bitmapOrPromise : bitmapOrPromise)
    } else {
      context.drawImage(this.#gl.canvas, 0, 0)
    }
  }

  toImageBitmap() {
    const { canvas } = this.#gl
    if (isOffscreenCanvas(canvas)) return canvas.transferToImageBitmap()
    else return createImageBitmap(canvas)
  }

  toBlob(options?: ImageEncodeOptions) {
    return canvasToBlob(this.#gl.canvas, options)
  }

  deleteTexture(texture: WebGLTexture) {
    this.#gl.deleteTexture(texture)
  }

  dispose() {
    const gl = this.#gl
    const programInfo = this.#programInfo

    this.#vertexBuffers.forEach((buffer) => gl.deleteBuffer(buffer))
    this.#vertexBuffers.length = 0

    gl.bindBuffer(GL.ARRAY_BUFFER, null)
    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null)
    gl.bindRenderbuffer(GL.RENDERBUFFER, null)
    gl.bindFramebuffer(GL.FRAMEBUFFER, null)

    Object.assign(this, { emptyTexture: undefined, emptyTexture3D: undefined })

    this.#uniforms.u_operations.length = 0

    for (const key in this.#uniforms) (this.#uniforms as any)[key] = null

    gl.deleteProgram(programInfo.program)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.#gl = this.#programInfo = undefined as never
    this.isDisposed = true
  }
}
