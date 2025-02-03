import { mat4 } from 'gl-matrix'
import * as twgl from 'twgl.js'

import { type Context2D, type CropState, type Size } from 'shared/types'
import {
  canvasToBlob,
  get2dContext,
  getWebgl2Context,
  isOffscreenCanvas,
  setObjectSize,
} from 'shared/utils/images'

import { LUT_TEX_OPTIONS, SOURCE_TEX_OPTIONS } from './constants'
import * as GL from './GL'
import vs from './glsl/main.vert'
import passthrough from './glsl/passthrough.frag'
import { type AssetType, type RendererEffect, type RendererEffectOp } from './types'

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
  #passthroughProgram: twgl.ProgramInfo
  #uniforms = {
    u_flipY: true,
    u_resolution: [1, 1],
    u_image: null as WebGLTexture | null,
    u_size: [1, 1],
    u_intensity: 1,
    u_matrix: mat4.create(),
    u_textureMatrix: mat4.create(),
  }
  #vertexBuffers: WebGLBuffer[] = []
  emptyTexture: WebGLTexture
  emptyTexture3D: WebGLTexture
  isDisposed = false

  effectOps: RendererEffectOp[] = []

  #fbs: [twgl.FramebufferInfo, twgl.FramebufferInfo]
  #fragmentsToPrograms = new Map<string, { programInfo: twgl.ProgramInfo; refCount: number }>()

  get canvas() {
    return this.#gl.canvas
  }
  scratchPad2d = get2dContext(undefined, { willReadFrequently: true })

  constructor({ gl = getWebgl2Context() } = {}) {
    this.#gl = gl

    this.#passthroughProgram = twgl.createProgramInfo(gl, [vs, passthrough])

    const unitQuad = new Float32Array([1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0])

    ;[
      unitQuad, // a_position
      unitQuad, // a_texCoord
    ].forEach((data, location) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- mismatch between TS and eslint?
      const buffer = gl.createBuffer()!

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(location)
      this.#vertexBuffers.push(buffer)
    })

    this.emptyTexture = this.createTexture()
    this.emptyTexture3D = this.createTexture(LUT_TEX_OPTIONS)

    const createFb = () =>
      twgl.createFramebufferInfo(gl, [
        { format: GL.RGBA, type: GL.UNSIGNED_BYTE, min: GL.LINEAR, wrap: GL.CLAMP_TO_EDGE },
      ])

    this.#fbs = [createFb(), createFb()]
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mismatch between TS and eslint?
    if (texture == undefined) throw new Error(`[miru] gl.createTexture() failed`)

    twgl.setTextureParameters(gl, texture, textureOptions)

    const data = new ImageData(new Uint8ClampedArray(4), 1)

    if (target === GL.TEXTURE_2D) gl.texImage2D(target, 0, internalFormat, 1, 1, 0, format, type, data)
    else gl.texImage3D(target, 0, internalFormat, 1, 1, 1, 0, format, type, data)

    return texture
  }

  loadImage(
    texture: WebGLTexture,
    source: TexImageSource,
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
    transform?: mat4,
  ) {
    crop ??= { x: 0, y: 0, width: textureSize.width, height: textureSize.height, rotate: 0 }

    this.#uniforms.u_flipY = flipY
    this.#uniforms.u_image = texture
    this.#uniforms.u_size = [crop.width, crop.height]
    this.#uniforms.u_resolution = [resolution.width, resolution.height]

    {
      const { width, height } = textureSize

      const { u_matrix } = this.#uniforms
      mat4.ortho(u_matrix, 0, width, height, 0, -1, 1)
      if (transform) mat4.multiply(u_matrix, transform, u_matrix)
      mat4.scale(u_matrix, u_matrix, [width, height, 1])

      const { u_textureMatrix } = this.#uniforms
      mat4.fromScaling(u_textureMatrix, [1 / width, 1 / height, 1])
      mat4.translate(u_textureMatrix, u_textureMatrix, [crop.x, crop.y, 0])
      mat4.scale(u_textureMatrix, u_textureMatrix, [crop.width, crop.height, 1])
    }

    const gl = this.#gl
    const { canvas } = gl

    {
      const { width, height } = resolution

      this.#fbs.forEach((fb) => {
        gl.bindTexture(GL.TEXTURE_2D, fb.attachments[0])
        gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, width, height, 0, GL.RGBA, GL.UNSIGNED_BYTE, null)
      })

      canvas.width = width
      canvas.height = height
    }
  }

  loadLut(texture: WebGLTexture, imageData: ImageData, type?: AssetType.Lut | AssetType.HaldLut) {
    const isHald = type === 'hald-lut'
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
    this.effectOps = (effect?.ops ?? []).slice()
  }

  setIntensity(value: number) {
    this.#uniforms.u_intensity = value
  }

  clear() {
    this.#gl.clear(GL.COLOR_BUFFER_BIT)
  }

  getProgram(fragmentShader: string) {
    const entry = this.#fragmentsToPrograms.get(fragmentShader) ?? {
      programInfo: twgl.createProgramInfo(this.#gl, [vs, fragmentShader]),
      refCount: 0,
    }

    entry.refCount++
    this.#fragmentsToPrograms.set(fragmentShader, entry)
    return entry.programInfo
  }

  dropProgram(fragmentShader: string) {
    const entry = this.#fragmentsToPrograms.get(fragmentShader)
    if (!entry) return

    entry.refCount--

    if (entry.refCount <= 0) {
      this.#gl.deleteProgram(entry.programInfo.program)
      this.#fragmentsToPrograms.delete(fragmentShader)
    }
  }

  draw(targetFrameBuffer: WebGLFramebuffer | null = null) {
    const gl = this.#gl

    gl.useProgram(this.#passthroughProgram.program)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.clearColor(0, 0, 0, 1)
    gl.enable(GL.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    twgl.setUniforms(this.#passthroughProgram, this.#uniforms)

    if (this.effectOps.length === 0) {
      gl.bindFramebuffer(GL.FRAMEBUFFER, targetFrameBuffer)
      gl.drawArrays(GL.TRIANGLES, 0, 6)
    } else {
      const [width, height] = this.#uniforms.u_resolution
      const u_matrix = mat4.ortho(mat4.create(), 0, width, height, 0, -1, 1)
      mat4.scale(u_matrix, u_matrix, [width, height, 1])
      const u_textureMatrix = mat4.identity(mat4.create())

      gl.bindFramebuffer(GL.FRAMEBUFFER, this.#fbs[0].framebuffer)
      gl.drawArrays(GL.TRIANGLES, 0, 6)

      const lastOpIndex = this.effectOps.length - 1

      this.effectOps.forEach((op, i) => {
        const sourceFbIndex = i % 2
        const targetFb =
          i === lastOpIndex ? targetFrameBuffer : this.#fbs[(sourceFbIndex + 1) % 2].framebuffer

        gl.useProgram(op.programInfo.program)
        gl.bindFramebuffer(GL.FRAMEBUFFER, targetFb)

        twgl.setUniforms(op.programInfo, {
          ...op.uniforms,
          ...this.#uniforms,
          u_flipY: true,
          u_matrix,
          u_textureMatrix,
          u_image: this.#fbs[sourceFbIndex].attachments[0],
          u_intensity: this.#uniforms.u_intensity * op.intensity,
        })
        gl.drawArrays(GL.TRIANGLES, 0, 6)
      })
    }

    if (!targetFrameBuffer) {
      const sync = gl.fenceSync(GL.SYNC_GPU_COMMANDS_COMPLETE, 0)
      gl.flush()

      if (sync == null) return
      if (gl.getSyncParameter(sync, GL.SYNC_STATUS) !== GL.SIGNALED) gl.clientWaitSync(sync, 0, 0)
      gl.deleteSync(sync)
    }
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
    const programInfo = this.#passthroughProgram

    this.#vertexBuffers.forEach((buffer) => gl.deleteBuffer(buffer))
    this.#vertexBuffers.length = 0

    gl.bindBuffer(GL.ARRAY_BUFFER, null)
    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null)
    gl.bindRenderbuffer(GL.RENDERBUFFER, null)
    gl.bindFramebuffer(GL.FRAMEBUFFER, null)

    Object.assign(this, { emptyTexture: undefined, emptyTexture3D: undefined })

    this.#fbs.forEach((fb) => {
      gl.deleteTexture(fb.attachments[0])
      gl.deleteFramebuffer(fb.framebuffer)
    })

    this.effectOps.length = 0

    for (const key in this.#uniforms) (this.#uniforms as any)[key] = null

    gl.deleteProgram(programInfo.program)
    this.#fragmentsToPrograms.forEach(({ programInfo }) => gl.deleteProgram(programInfo.program))
    this.#fragmentsToPrograms.clear()

    gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.#gl = this.#passthroughProgram = undefined as never
    this.isDisposed = true
  }
}
