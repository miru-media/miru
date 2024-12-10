import { mat4 } from 'gl-matrix'
import VideoContext, { type RenderGraph } from 'videocontext'

import { type EffectInternal } from 'reactive-effects/Effect'
import { FRAMEBUFFER_TEX_OPTIONS } from 'renderer/constants'
import * as GL from 'renderer/GL'
import { type Renderer } from 'renderer/Renderer'
import { DecoderStream } from 'shared/transcode/DecoderStream'
import { type DemuxerChunkInfo } from 'shared/transcode/demuxer'
import { assertDecoderConfigIsSupported } from 'shared/transcode/utils'
import { type AdjustmentsState, type Size } from 'shared/types'
import { fit, setObjectSize } from 'shared/utils'

type CustomNode = MiruVideoElementNode | MiruVideoExtractorNode

function constructor(node: CustomNode, gl: WebGLRenderingContext, { renderer }: { renderer: Renderer }) {
  node.renderer = renderer
  node.mediaTexture = node._texture
  node.outTexture = renderer.createTexture(FRAMEBUFFER_TEX_OPTIONS)

  updateSize(node)

  node.framebuffer = gl.createFramebuffer()!
  gl.bindFramebuffer(GL.FRAMEBUFFER, node.framebuffer)
  gl.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, node.outTexture, 0)
  gl.bindFramebuffer(GL.FRAMEBUFFER, null)
}

function updateSize(node: CustomNode) {
  const gl = node._gl
  const { width, height } = gl.canvas

  if (width === node.framebufferSize.width && height === node.framebufferSize.height) return

  setObjectSize(node.framebufferSize, gl.canvas)
  gl.bindTexture(GL.TEXTURE_2D, node.outTexture)
  gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, width, height, 0, GL.RGBA, GL.UNSIGNED_BYTE, null)
}

function _update(node: CustomNode, currentTime: number, triggerTextureUpdate = true): boolean {
  updateSize(node)

  const renderer = node.renderer
  const gl = node._gl

  node._texture = node.mediaTexture
  const superUpdated = node._superUpdate(currentTime, triggerTextureUpdate)

  const isBeforeStart = currentTime < node.startTime
  const shouldRender = triggerTextureUpdate && superUpdated && !isBeforeStart

  if (shouldRender) {
    gl.bindTexture(GL.TEXTURE_2D, node.outTexture)
    gl.bindFramebuffer(gl.FRAMEBUFFER, node.framebuffer)
    gl.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, node.outTexture, 0)

    const coverSize = fit(node.mediaSize, gl.canvas, 'cover')
    const transform = mat4.fromScaling(new Float32Array(16), [
      coverSize.width / gl.canvas.width,
      coverSize.height / gl.canvas.height,
      1,
    ])

    renderer.setSourceTexture(node.mediaTexture, gl.canvas, node.mediaSize, undefined, true, transform)
    renderer.setEffect(node.effect)
    renderer.setIntensity(node.intensity)
    renderer.draw(node.framebuffer)
    node._texture = node.outTexture
  }

  return superUpdated
}

function _seek(node: CustomNode, time: number) {
  // avoid resizing the framebuffer texture
  node._texture = node.mediaTexture
  node._superSeek(time)
  node._texture = node.outTexture
}

function destroy(node: CustomNode) {
  node.renderer.deleteTexture(node.mediaTexture)
  node.renderer.deleteTexture(node.outTexture)
  node.renderer = undefined as never
}

export class MiruVideoElementNode extends VideoContext.NODES.VideoNode {
  src!: HTMLVideoElement
  mediaSize: Size = { width: 1, height: 1 }
  renderer!: Renderer
  mediaTexture!: WebGLTexture
  outTexture!: WebGLTexture
  framebuffer!: WebGLFramebuffer
  framebufferSize: Size = { width: 1, height: 1 }

  declare _texture: WebGLTexture
  declare _gl: WebGL2RenderingContext
  declare _startTime: number

  effect?: EffectInternal
  intensity = 1
  adjustments: AdjustmentsState = { brightness: 0, contrast: 0, saturation: 0 }

  updateSize = updateSize.bind(null, this)
  _update = _update.bind(null, this)
  _seek = _seek.bind(null, this)

  constructor(
    src: HTMLVideoElement,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,
    playbackRate: number,
    sourceOffset: number,
    preloadTime: number,
    options: { renderer: Renderer; width: number; height: number },
  ) {
    super(src, gl, renderGraph, currentTime, playbackRate, sourceOffset, preloadTime, undefined)
    constructor(this, gl, options)
    this.src = src
    this._displayName = 'MiruVideoElementNode'
  }

  _superUpdate(currentTime: number, triggerTextureUpdate: boolean) {
    return super._update(currentTime, triggerTextureUpdate)
  }

  _superSeek(time: number) {
    super._seek(time)
  }

  destroy() {
    destroy(this)
    super.destroy()
  }
}

interface VideoDecoderNodeOptions {
  renderer: Renderer
  url: string
  sourceOffset: number
  start: number
  end: number
  fps: number
}

export class MiruVideoExtractorNode extends VideoContext.NODES.SourceNode {
  url: string
  samples!: DemuxerChunkInfo[]
  videoConfig!: VideoDecoderConfig
  fps!: number
  mediaSize: Size = { width: 1, height: 1 }
  renderer!: Renderer
  mediaTexture!: WebGLTexture
  outTexture!: WebGLTexture
  framebuffer!: WebGLFramebuffer
  framebufferSize: Size = { width: 1, height: 1 }

  declare _texture: WebGLTexture
  declare _gl: WebGL2RenderingContext

  _sourceOffset: number

  effect?: EffectInternal
  intensity = 1
  adjustments: AdjustmentsState = { brightness: 0, contrast: 0, saturation: 0 }

  updateSize = updateSize.bind(null, this)
  _update = _update.bind(null, this)
  _seek = _seek.bind(null, this)

  decoderStream?: DecoderStream
  lastRead: { done: boolean; value?: VideoFrame | DemuxerChunkInfo } = { done: false, value: undefined }
  onError?: (error: unknown) => void

  get isReady() {
    return this._ready
  }

  constructor(
    _src: undefined,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,
    options: VideoDecoderNodeOptions,
  ) {
    super(undefined, gl, renderGraph, currentTime)
    constructor(this, gl, options)
    this.url = options.url
    this._sourceOffset = options.sourceOffset
    this._displayName = 'MiruVideoExtractorNode'
  }

  async init({
    samples,
    videoConfig,
    fps,
    width,
    height,
  }: {
    samples: DemuxerChunkInfo[]
    videoConfig: VideoDecoderConfig
    fps: number
    width: number
    height: number
  }) {
    await assertDecoderConfigIsSupported(videoConfig)

    this.samples = samples
    this.videoConfig = videoConfig
    this.fps = fps

    this.mediaSize.width = width
    this.mediaSize.height = height
  }

  async seek(timeS: number) {
    if (this.lastRead.done) return

    const { startTime, stopTime } = this

    if (timeS < startTime || timeS >= stopTime) {
      this._element = undefined
      return
    }

    const sourceTimeUs = (timeS - startTime + this._sourceOffset) * 1e6

    if (this.#hasFrameAtTimeUs(sourceTimeUs)) {
      this._ready = true
      return
    }

    this._ready = false
    if (!this.lastRead.value) await this.readNext()

    while (this.lastRead.value) {
      if (this.#hasFrameAtTimeUs(sourceTimeUs)) {
        this._element = this.lastRead.value as VideoFrame
        this._ready = true
        break
      }

      if (this.lastRead.done as boolean) break

      await this.readNext()
    }
  }

  async readNext() {
    if (!this.decoderStream) {
      const { videoConfig, startTime, stopTime } = this
      const sourceOffset = this._sourceOffset

      this.decoderStream = new DecoderStream(this.samples, {
        start: sourceOffset,
        end: sourceOffset + (stopTime - startTime),
        onError: (error) => this.onError?.(error),
        videoConfig,
      })

      await this.decoderStream.init()
    }

    this.closeCurrentFrame()
    this.lastRead = await this.decoderStream.read()
  }

  closeCurrentFrame() {
    const frame = this.lastRead.value
    if (frame && 'close' in frame) frame.close()
  }

  #hasFrameAtTimeUs(sourceTimeUs: number) {
    const { value } = this.lastRead

    return (
      !!value &&
      value instanceof VideoFrame &&
      value.timestamp + (value.duration ?? 1e6 / this.fps) >= sourceTimeUs
    )
  }

  _superUpdate(currentTime: number, triggerTextureUpdate: boolean) {
    return super._update(currentTime, triggerTextureUpdate)
  }

  _superSeek(time: number) {
    super._seek(time)
  }

  destroy() {
    destroy(this)
    this.closeCurrentFrame()
    this.decoderStream?.dispose()

    super.destroy()
  }
}
