import { computed, type Ref, ref } from 'fine-jsx'
import { mat4 } from 'gl-matrix'
import VideoContext, { type RenderGraph } from 'videocontext'
import { FRAMEBUFFER_TEX_OPTIONS, type Renderer } from 'webgl-effects'

import { type Effect } from 'reactive-effects/Effect'
import { type AdjustmentsState, type Size } from 'shared/types'
import { fit, setObjectSize } from 'shared/utils'
import { clamp } from 'shared/utils/math'

import { SourceNodeState, VIDEO_PRESEEK_TIME_S } from '../constants'
import { type ClipTime, type CustomSourceNodeOptions } from '../types'

const rangeContainsTime = (range: { start: number; end: number }, time: number) => {
  return range.start <= time && time < range.end
}

export abstract class CustomSourceNode extends VideoContext.NODES.GraphNode {
  declare media?: TexImageSource | HTMLAudioElement
  mediaSize: Size = { width: 1, height: 1 }
  renderer!: Renderer
  mediaTexture!: WebGLTexture
  outTexture!: WebGLTexture
  framebuffer!: WebGLFramebuffer
  framebufferSize: Size = { width: 1, height: 1 }

  effect?: Effect
  intensity = 1
  adjustments: AdjustmentsState = { brightness: 0, contrast: 0, saturation: 0 }

  getClipTime: () => ClipTime
  getPresentationTime: () => ClipTime
  movieIsPaused: Ref<boolean>
  movieTime = ref(0)
  abstract mediaTime: Ref<number>

  expectedMediaTime = computed(() => {
    const { start, end, source } = this.playableTime
    return clamp(this.movieTime.value, start, end) - start + source
  })

  abstract everHadEnoughData: boolean

  get clipTime() {
    return this.getClipTime()
  }
  get presentationTime() {
    return this.getPresentationTime()
  }
  get playableTime() {
    const time = this.getPresentationTime()
    if (time.source >= 0) return time

    const { start, end, source, duration } = time
    return { start: start - source, source: 0, duration: duration + source, end }
  }

  isInPreloadTime = computed(() => {
    const movieTime = this.movieTime.value
    const { start } = this.presentationTime
    return start - VIDEO_PRESEEK_TIME_S < movieTime && movieTime < start
  })
  isInPresentationTime = computed(() => rangeContainsTime(this.presentationTime, this.movieTime.value))
  isInPlayableTime = computed(() => rangeContainsTime(this.playableTime, this.movieTime.value))
  isInClipTime = computed(() => rangeContainsTime(this.clipTime, this.movieTime.value))

  shouldPlay = computed(() => this.isInPlayableTime.value && !this.movieIsPaused.value)

  get shouldRender() {
    return this.isInPresentationTime.value
  }

  get _texture() {
    return this.outTexture
  }

  computedState = computed(() => {
    const movieTime = this.movieTime.value
    const { presentationTime } = this

    if (movieTime >= presentationTime.end) return SourceNodeState.ended

    if (!this.everHadEnoughData || movieTime < presentationTime.start) return SourceNodeState.sequenced

    if (!this.shouldPlay.value) return SourceNodeState.paused

    return SourceNodeState.playing
  })

  get _state() {
    return this.computedState.value
  }
  get state() {
    return this.computedState.value
  }
  get _startTime() {
    return this.presentationTime.start
  }
  get _stopTime() {
    return this.presentationTime.end
  }

  constructor(
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,

    // our options
    options: CustomSourceNodeOptions,
  ) {
    super(gl, renderGraph, [], true)

    this.getClipTime = options.getClipTime
    this.getPresentationTime = options.getPresentationTime
    this.movieIsPaused = options.movieIsPaused
    this.movieTime.value = currentTime

    const { renderer } = options
    this.renderer = renderer
    this.mediaTexture = renderer.createTexture(FRAMEBUFFER_TEX_OPTIONS)
    this.outTexture = renderer.createTexture(FRAMEBUFFER_TEX_OPTIONS)
    this.updateSize()

    this.framebuffer = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer)
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outTexture, 0)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)

    this._displayName = 'video-editor:CustomSourceNode'
  }

  updateSize() {
    const gl = this._gl
    const { width, height } = gl.canvas

    if (width === this.framebufferSize.width && height === this.framebufferSize.height) return

    setObjectSize(this.framebufferSize, gl.canvas)
    gl.bindTexture(gl.TEXTURE_2D, this.outTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  abstract _isReady(): boolean

  _seek(movieTime: number) {
    this.movieTime.value = movieTime

    return (this.mediaTime.value = this.expectedMediaTime.value)
  }

  _update(movieTime: number): boolean {
    this.movieTime.value = movieTime

    const { renderer, media } = this

    if (!this.shouldRender || !media || ('nodeName' in media && media.nodeName === 'AUDIO')) return false

    this.updateSize()

    renderer.loadImage(this.mediaTexture, media as Exclude<typeof media, HTMLAudioElement>)

    const gl = this._gl as WebGL2RenderingContext
    const coverSize = fit(this.mediaSize, gl.canvas, 'cover')
    const transform = mat4.fromScaling(new Float32Array(16), [
      coverSize.width / gl.canvas.width,
      coverSize.height / gl.canvas.height,
      1,
    ])

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer)
    renderer.setSourceTexture(this.mediaTexture, gl.canvas, this.mediaSize, undefined, false, transform)
    renderer.setEffect(this.effect)
    renderer.setIntensity(this.intensity)
    renderer.draw(this.framebuffer)

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)

    return true
  }

  abstract _play(): void
  abstract _pause(): void

  destroy() {
    super.destroy()
    this.renderer.deleteTexture(this.mediaTexture)
    this.renderer.deleteTexture(this.outTexture)
    this.renderer = undefined as never
  }
}
