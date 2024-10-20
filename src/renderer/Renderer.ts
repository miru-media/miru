import { mat4 } from 'gl-matrix'
import * as twgl from 'twgl.js'

import { EffectOpType, LUT_TEX_OPTIONS, MAX_EFFECT_OPS, SOURCE_TEX_OPTIONS } from '@/constants'
import * as GL from '@/GL'
import {
  AdjustmentsState,
  Context2D,
  CropState,
  RendererEffect,
  RendererEffectOp,
  Size,
  SyncImageSource,
} from '@/types'
import { canvasToBlob, getWebgl2Context, isOffscreenCanvas, setObjectSize } from '@/utils'

import fs from './glsl/main.frag'
import vs from './glsl/main.vert'

export interface RendererOptions {
  gl?: WebGL2RenderingContext
  canvas?: HTMLCanvasElement | OffscreenCanvas
}

export class Renderer {
  #gl: WebGL2RenderingContext
  #programInfo: twgl.ProgramInfo
  #uniforms = {
    u_resolution: [1, 1],
    u_source: null as WebGLTexture | null,
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
  readonly emptyTexture: WebGLTexture
  readonly emptyTexture3D: WebGLTexture
  isDisposed = false

  #emptyAdjustments: AdjustmentsState = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
  }

  get canvas() {
    return this.#gl.canvas
  }

  constructor({ gl = getWebgl2Context() } = {}) {
    this.#gl = gl

    gl.clearColor(0, 0, 0, 1)
    gl.enable(GL.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    this.#programInfo = twgl.createProgramInfo(gl, [vs, fs])

    const unitQuad = [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1]

    ;[
      // u_position
      unitQuad,
      // u_texcoord
      unitQuad,
    ].forEach((data, index) => {
      const buffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
      gl.vertexAttribPointer(index, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(index)
      this.#vertexBuffers.push(buffer)
    })

    this.emptyTexture = gl.createTexture()!
    this.emptyTexture3D = gl.createTexture()!
  }

  setSourceTexture(texture: WebGLTexture, resolution: Size, textureSize: Size, crop?: CropState) {
    crop ??= { x: 0, y: 0, width: textureSize.width, height: textureSize.height, rotate: 0 }

    this.#uniforms.u_source = texture
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

    for (let i = 0; i < MAX_EFFECT_OPS; i++) paddedOps[i] = ops[i] || noop

    this.#uniforms.u_images = images
    this.#uniforms.u_luts = luts
    this.#uniforms.u_operations = paddedOps
  }

  loadLut(texture: WebGLTexture, imageData: ImageData, isHald?: boolean) {
    this.#loadLut(texture, imageData, isHald)
  }

  #loadLut(texture: WebGLTexture, imageData?: ImageData, isHald?: boolean) {
    const gl = this.#gl

    if (!imageData) return

    const format = GL.RGBA
    const type = GL.UNSIGNED_BYTE

    const { width, height } = imageData
    const size = Math.cbrt(width * height)
    const slicesPerRow = width / size

    twgl.setTextureParameters(gl, texture, LUT_TEX_OPTIONS)

    if (isHald || width === 1 || height === 1) {
      gl.texImage3D(GL.TEXTURE_3D, 0, format, size, size, size, 0, format, type, imageData.data)
      return
    }

    const pixelBuffer = gl.createBuffer()!
    gl.pixelStorei(GL.UNPACK_ALIGNMENT, 4)
    gl.pixelStorei(GL.UNPACK_ROW_LENGTH, width)
    gl.pixelStorei(GL.UNPACK_IMAGE_HEIGHT, height)
    gl.texStorage3D(GL.TEXTURE_3D, 1, GL.RGBA8, size, size, size)

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

    gl.deleteBuffer(pixelBuffer)
    gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, null)
  }

  createTexture() {
    return this.#gl.createTexture()
  }

  loadImage(
    texture: WebGLTexture,
    source: SyncImageSource,
    textureOptions: Omit<twgl.TextureOptions, 'width' | 'height'> = SOURCE_TEX_OPTIONS,
  ) {
    const { internalFormat = GL.RGBA8, format = GL.RGBA, type = GL.UNSIGNED_BYTE } = textureOptions

    twgl.setTextureParameters(this.#gl, texture, textureOptions)
    this.#gl.texImage2D(GL.TEXTURE_2D, 0, internalFormat, format, type, source)
    if (textureOptions.auto) this.#gl.generateMipmap(GL.TEXTURE_2D)
  }

  deleteTexture(texture: WebGLTexture) {
    this.#gl.deleteTexture(texture)
  }

  setIntensity(value: number) {
    this.#uniforms.u_intensity = value
  }

  setAdjustments(value = this.#emptyAdjustments) {
    this.#uniforms.u_adjustments = value
  }

  draw() {
    const gl = this.#gl

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)

    gl.useProgram(this.#programInfo.program)

    twgl.setUniforms(this.#programInfo, this.#uniforms)
    gl.clear(GL.COLOR_BUFFER_BIT)
    gl.drawArrays(GL.TRIANGLES, 0, 6)

    const sync = gl.fenceSync(GL.SYNC_GPU_COMMANDS_COMPLETE, 0)
    if (!sync) return

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
