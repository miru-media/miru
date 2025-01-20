import { mat4 } from 'gl-matrix'
import VideoContext, { type RenderGraph } from 'videocontext'
import { FRAMEBUFFER_TEX_OPTIONS } from 'webgl-effects'
import { type Renderer } from 'webgl-effects'

import { type EffectInternal } from 'reactive-effects/Effect'
import { AudioDecoderStream, VideoDecoderStream } from 'shared/transcode/DecoderStream'
import { type DemuxerChunkInfo } from 'shared/transcode/demuxer'
import { type AdjustmentsState, type Size } from 'shared/types'
import { fit, setObjectSize, win } from 'shared/utils'

type CustomNode = CustomVideoElementNode | Mp4ExtractorNode

const GL = win.WebGL2RenderingContext

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

export class CustomVideoElementNode extends VideoContext.NODES.VideoNode {
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

export interface ExtractorNodeOptions {
  renderer: Renderer
  url: string
  sourceOffset: number
  start: number
  end: number
  targetFrameRate: number
}

export namespace Mp4ExtractorNode {
  export interface AudioInit {
    config: AudioDecoderConfig
    chunks: DemuxerChunkInfo[]
    audioBuffer?: AudioBuffer
  }
  export interface VideoInit {
    config: VideoDecoderConfig & { codedWidth: number; codedHeight: number }
    chunks: DemuxerChunkInfo[]
  }
}
export class Mp4ExtractorNode extends VideoContext.NODES.SourceNode {
  url: string
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

  audioInit?: Mp4ExtractorNode.AudioInit
  videoInit?: Mp4ExtractorNode.VideoInit

  videoStream?: VideoDecoderStream
  audioStream?: AudioDecoderStream
  streamInit!: { start: number; end: number; onError: (error: unknown) => void }
  targetFrameDurationUs: number

  get currentVideoFrame() {
    return this.videoStream?.currentValue
  }
  get currentAudioData() {
    const audioBuffer = this.audioInit?.audioBuffer

    if (audioBuffer) return { timestamp: 0, duration: audioBuffer.duration * 1e6, buffer: audioBuffer }
    return this.audioStream?.currentValue
  }

  onError?: (error: unknown) => void

  _audioReady = false
  get isReady() {
    return this._ready && this._audioReady
  }

  constructor(
    _src: undefined,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,
    options: ExtractorNodeOptions,
  ) {
    super(undefined, gl, renderGraph, currentTime)
    constructor(this, gl, options)
    this.url = options.url
    this._sourceOffset = options.sourceOffset
    this._displayName = 'Mp4ExtractorNode'
    this.targetFrameDurationUs = 1e6 / options.targetFrameRate
  }

  init({ audio, video }: { audio?: Mp4ExtractorNode.AudioInit; video?: Mp4ExtractorNode.VideoInit }) {
    if (audio) this.audioInit = audio
    if (video) {
      const { codedWidth, codedHeight } = video.config

      this.videoInit = video
      this.mediaSize.width = codedWidth
      this.mediaSize.height = codedHeight
    }

    const { startTime, stopTime } = this
    const start = this._sourceOffset
    const end = start + (stopTime - startTime)
    const onError = (error: unknown) => this.onError?.(error)
    this.streamInit = { start, end, onError }
  }

  async seekVideo(timeS: number): Promise<boolean> {
    this._ready = true
    if (!this.videoInit || this.videoStream?.doneReading) return false

    const { startTime, stopTime } = this

    if (timeS < startTime || timeS >= stopTime) {
      this._element = undefined
      return false
    }

    const sourceTimeUs = (timeS - startTime + this._sourceOffset) * 1e6

    if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) {
      this._element = this.currentVideoFrame
      return true
    }

    this._ready = false

    if (!this.videoStream) {
      const { chunks, config } = this.videoInit
      this.videoStream = await new VideoDecoderStream({ chunks, config, ...this.streamInit }).init()
    }

    if (!this.currentVideoFrame) await this.videoStream.read()

    while (this.currentVideoFrame) {
      if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) {
        this._element = this.currentVideoFrame
        this._ready = true
        return true
      }

      if (this.videoStream.doneReading) break

      await this.videoStream.read()
    }

    return false
  }

  async seekAudio(timeS: number): Promise<boolean> {
    if (!this.audioInit || (!this.audioInit.audioBuffer && this.audioStream?.doneReading)) return false

    const { startTime, stopTime } = this

    if (timeS < startTime || timeS >= stopTime) return false
    if (this.audioInit.audioBuffer) return true

    const sourceTimeUs = (timeS - startTime + this._sourceOffset) * 1e6

    if (this.#hasAudioFrameAtTimeUs(sourceTimeUs)) return true

    this._ready = false

    if (!this.audioStream) {
      const { chunks, config } = this.audioInit
      this.audioStream = await new AudioDecoderStream({ chunks, config, ...this.streamInit }).init()
    }

    if (!this.currentAudioData) await this.audioStream.read()

    while (this.currentAudioData) {
      if (this.#hasAudioFrameAtTimeUs(sourceTimeUs)) return true
      await this.audioStream.read()
    }
    return false
  }

  #hasVideoFrameAtTimeUs(sourceTimeUs: number) {
    const frame = this.videoStream?.currentValue
    if (!frame) return false

    const frameCenter = frame.timestamp + frame.duration! / 2
    const targetFrameCenter = sourceTimeUs + this.targetFrameDurationUs / 2
    return frameCenter >= targetFrameCenter - 10 || frame.timestamp + frame.duration! >= sourceTimeUs
  }

  #hasAudioFrameAtTimeUs(sourceTimeUs: number) {
    const data = this.audioStream?.currentValue
    if (!data) return false
    return data.timestamp <= sourceTimeUs && sourceTimeUs < data.timestamp + data.duration
  }

  _superUpdate(currentTime: number, triggerTextureUpdate: boolean) {
    return super._update(currentTime, triggerTextureUpdate)
  }

  _superSeek(time: number) {
    super._seek(time)
  }

  destroy() {
    destroy(this)
    this.videoStream?.dispose()

    super.destroy()
  }
}
