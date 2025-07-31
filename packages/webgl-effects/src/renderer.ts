import { mat4 } from 'gl-matrix'
import * as twgl from 'twgl.js'

import { timeout } from 'shared/utils'
import {
  canvasToBlob,
  drawImage,
  get2dContext,
  getWebgl2Context,
  isOffscreenCanvas,
  setObjectSize,
} from 'shared/utils/images'

import { LUT_TEX_OPTIONS, SOURCE_TEX_OPTIONS } from './constants.ts'
import * as GL from './gl.ts'
import vs from './glsl/main.vert'
import passthrough from './glsl/passthrough.frag'
import type { Renderer as Renderer_ } from './types/classes.ts'
import type {
  AssetType,
  Context2D,
  CropState,
  RendererDrawOptions,
  RendererEffect,
  RendererEffectOp,
} from './types/core.ts'

interface Size {
  width: number
  height: number
}

const DRAW_COUNT = 6

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

export class Renderer implements Renderer_ {
  #gl: WebGL2RenderingContext
  readonly #ownsGl: boolean
  #passthroughProgram: twgl.ProgramInfo
  readonly #uniforms = {
    u_flipY: true,
    u_resolution: [1, 1],
    u_image: null as WebGLTexture | null,
    u_size: [1, 1],
    u_intensity: 1,
    u_matrix: mat4.create(),
    u_textureMatrix: mat4.create(),
  }
  readonly #vertexBuffers: WebGLBuffer[] = []
  isDisposed = false

  effectOps: RendererEffectOp[] = []

  readonly #fbs: [twgl.FramebufferInfo, twgl.FramebufferInfo]
  readonly #fragmentsToPrograms = new Map<string, { programInfo: twgl.ProgramInfo; refCount: number }>()

  get canvas() {
    return this.#gl.canvas
  }
  scratchPad2d = get2dContext(undefined, { willReadFrequently: true })

  constructor({ gl }: { gl?: WebGL2RenderingContext } = {}) {
    if (gl) this.#ownsGl = true
    else {
      gl = getWebgl2Context()
      this.#ownsGl = true
    }

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
    if (texture == null) throw new Error(`[miru] gl.createTexture() failed`)

    twgl.setTextureParameters(gl, texture, textureOptions)

    const data = new ImageData(new Uint8ClampedArray(4), 1)

    if (target === GL.TEXTURE_2D) gl.texImage2D(target, 0, internalFormat, 1, 1, 0, format, type, data)
    else gl.texImage3D(target, 0, internalFormat, 1, 1, 1, 0, format, type, data)

    return texture
  }

  createFramebufferAndTexture(size?: Size) {
    const gl = this.#gl
    const texture = this.createTexture()
    if (size) this.resizeTexture(texture, size)

    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)

    return { framebuffer, texture }
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

  // eslint-disable-next-line @typescript-eslint/max-params -- internal
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

    {
      const { width, height } = resolution

      this.#fbs.forEach((fb) => {
        gl.bindTexture(GL.TEXTURE_2D, fb.attachments[0])
        gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, width, height, 0, GL.RGBA, GL.UNSIGNED_BYTE, null)
      })
    }
  }

  loadLut(texture: WebGLTexture, imageData: ImageData, type?: AssetType.Lut | AssetType.HaldLut) {
    const isHald = type === 'hald-lut'
    this.#loadLut(texture, imageData, isHald)
  }

  #loadLut(texture: WebGLTexture, imageData: ImageData | undefined, isHald: boolean) {
    const gl = this.#gl

    if (imageData == null) return

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

  resizeTexture(
    texture: WebGLTexture,
    size: Size,
    {
      target = GL.TEXTURE_2D,
      level = 0,
      internalFormat = GL.RGBA,
      format = GL.RGBA,
      type = GL.UNSIGNED_BYTE,
    }: twgl.TextureOptions = SOURCE_TEX_OPTIONS,
  ) {
    const gl = this.#gl
    gl.bindTexture(target, texture)
    gl.texImage2D(target, level, internalFormat, size.width, size.height, 0, format, type, null)
  }

  clear(color: ArrayLike<number> = [0, 0, 0, 1]) {
    const gl = this.#gl
    gl.clearColor(color[0], color[1], color[2], color[3])
    gl.clear(GL.COLOR_BUFFER_BIT)
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

  draw(options: RendererDrawOptions = {}) {
    const gl = this.#gl

    const { framebuffer: outFramebuffer = null } = options
    const { u_resolution } = this.#uniforms
    const resolution = { width: u_resolution[0], height: u_resolution[1] }

    const viewport = [
      options.x ?? 0,
      options.y ?? 0,
      options.width ?? resolution.width,
      options.height ?? resolution.height,
    ] as const

    const setViewport = () => {
      gl.viewport(...viewport)
      gl.scissor(...viewport)
    }

    // if drawing directly to the canvas, update its size
    if (!outFramebuffer) {
      const [width, height] = this.#uniforms.u_resolution
      const { canvas } = gl
      canvas.width = width
      canvas.height = height
    }

    gl.enable(GL.BLEND)
    gl.enable(gl.SCISSOR_TEST)

    gl.useProgram(this.#passthroughProgram.program)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.viewport(0, 0, resolution.width, resolution.height)
    gl.scissor(0, 0, resolution.width, resolution.height)

    twgl.setUniforms(this.#passthroughProgram, this.#uniforms)

    if (this.effectOps.length === 0) {
      gl.bindFramebuffer(GL.FRAMEBUFFER, outFramebuffer)
      setViewport()
      if (options.clear) this.clear()

      gl.drawArrays(GL.TRIANGLES, 0, DRAW_COUNT)
    } else {
      const { width, height } = resolution
      const u_matrix = mat4.ortho(mat4.create(), 0, width, height, 0, -1, 1)
      mat4.scale(u_matrix, u_matrix, [width, height, 1])
      const u_textureMatrix = mat4.identity(mat4.create())

      gl.bindFramebuffer(GL.FRAMEBUFFER, this.#fbs[0].framebuffer)
      gl.drawArrays(GL.TRIANGLES, 0, DRAW_COUNT)

      const lastOpIndex = this.effectOps.length - 1

      this.effectOps.forEach((op, i) => {
        const sourceFbIndex = i % 2
        const isLast = i === lastOpIndex
        const targetFb = isLast ? outFramebuffer : this.#fbs[(sourceFbIndex + 1) % 2].framebuffer

        gl.useProgram(op.programInfo.program)
        gl.bindFramebuffer(GL.FRAMEBUFFER, targetFb)

        if (isLast) {
          setViewport()
          if (options.clear) this.clear()
        }

        twgl.setUniforms(op.programInfo, {
          ...op.uniforms,
          ...this.#uniforms,
          u_flipY: true,
          u_matrix,
          u_textureMatrix,
          u_image: this.#fbs[sourceFbIndex].attachments[0],
          u_intensity: this.#uniforms.u_intensity * op.intensity,
        })
        gl.drawArrays(GL.TRIANGLES, 0, DRAW_COUNT)
      })
    }

    if (!outFramebuffer) this.waitSync()
  }

  #flushWaitSync() {
    const gl = this.#gl
    const sync = gl.fenceSync(GL.SYNC_GPU_COMMANDS_COMPLETE, 0)
    gl.flush()

    const status = sync && gl.clientWaitSync(sync, 0, 0)

    // eslint-disable-next-line no-console -- --
    if (status === GL.WAIT_FAILED) console.warn('[webgl-effects] gl.clientWaitSync() failed!')

    return { sync, status }
  }

  waitSync() {
    const gl = this.#gl
    const { sync } = this.#flushWaitSync()

    if (sync) gl.deleteSync(sync)
  }

  async waitAsync(intervalMs = 10) {
    const gl = this.#gl
    const { sync, status } = this.#flushWaitSync()

    if (!sync) return

    let waitRes = status
    while (waitRes === GL.TIMEOUT_EXPIRED) {
      await timeout(intervalMs)
      waitRes = gl.clientWaitSync(sync, 0, 0)
    }

    gl.deleteSync(sync)

    if (status === GL.WAIT_FAILED) throw new Error('[webgl-effects] gl.clientWaitSync() failed!')
  }

  async drawAndTransfer(options: RendererDrawOptions & { context: Context2D | ImageBitmapRenderingContext }) {
    this.draw(options)

    const gl = this.#gl
    const { context } = options
    const { canvas } = context
    const { u_resolution } = this.#uniforms

    const size = {
      width: options.width ?? u_resolution[0],
      height: options.height ?? u_resolution[1],
    }
    setObjectSize(canvas, size)

    const image = options.framebuffer ? await this.getImageData(options.framebuffer, size) : gl.canvas

    if (context instanceof ImageBitmapRenderingContext) {
      const bitmapOrPromise = isOffscreenCanvas(gl.canvas)
        ? gl.canvas.transferToImageBitmap()
        : createImageBitmap(gl.canvas)
      context.transferFromImageBitmap('then' in bitmapOrPromise ? await bitmapOrPromise : bitmapOrPromise)
    } else {
      drawImage(context, image, 0, 0)
    }
  }

  async getImageData(framebuffer: WebGLFramebuffer, size: Size) {
    const gl = this.#gl
    const pbo = gl.createBuffer()
    const image = new ImageData(size.width, size.height)
    const { byteLength } = image.data

    gl.bindBuffer(GL.PIXEL_PACK_BUFFER, pbo)
    gl.bufferData(GL.PIXEL_PACK_BUFFER, byteLength, GL.STREAM_READ)

    gl.bindFramebuffer(GL.READ_FRAMEBUFFER, framebuffer)
    gl.readPixels(0, 0, size.width, size.height, GL.RGBA, GL.UNSIGNED_BYTE, 0)

    gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null)
    gl.bindFramebuffer(GL.READ_FRAMEBUFFER, null)

    try {
      await this.waitAsync()
      gl.bindBuffer(GL.PIXEL_PACK_BUFFER, pbo)
      gl.getBufferSubData(GL.PIXEL_PACK_BUFFER, 0, image.data, 0, byteLength)
    } finally {
      gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null)
      gl.deleteBuffer(pbo)
    }

    return image
  }

  async toBlob(options?: ImageEncodeOptions) {
    return await canvasToBlob(this.#gl.canvas, options)
  }

  deleteTexture(texture: WebGLTexture) {
    this.#gl.deleteTexture(texture)
  }
  deleteFramebuffer(framebuffer: WebGLFramebuffer) {
    this.#gl.deleteFramebuffer(framebuffer)
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

    for (const key in this.#uniforms)
      if (Object.hasOwn(this.#uniforms, key)) (this.#uniforms as any)[key] = null

    gl.deleteProgram(programInfo.program)
    this.#fragmentsToPrograms.forEach(({ programInfo }) => gl.deleteProgram(programInfo.program))
    this.#fragmentsToPrograms.clear()
    this.#passthroughProgram = undefined as never

    if (this.#ownsGl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      this.#gl = undefined as never
    }

    this.isDisposed = true
  }
}
