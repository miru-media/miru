import { computed, type Ref, ref } from 'fine-jsx'
import { mat4 } from 'gl-matrix'
import VideoContext, { type RenderGraph } from 'videocontext'
import { FRAMEBUFFER_TEX_OPTIONS, type Renderer } from 'webgl-effects'

import { type Effect } from 'reactive-effects/Effect'
import { type AdjustmentsState, type Size } from 'shared/types'
import { IS_FIREFOX } from 'shared/userAgent'
import { fit, isElement, setObjectSize } from 'shared/utils'
import { clamp } from 'shared/utils/math'

import { SourceNodeState, VIDEO_PRESEEK_TIME_S } from '../constants'
import { type Schema } from '../nodes'
import { type ClipTime, type CustomSourceNodeOptions } from '../types'
import { getImageSize, isAudioElement } from '../utils'

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
  source: Schema.AvMediaAsset

  videoEffect?: Ref<Effect | undefined>
  videoEffectIntensity?: Ref<number>
  adjustments: AdjustmentsState = { brightness: 0, contrast: 0, saturation: 0 }

  abstract mediaTime: Ref<number>
  movieTime = ref(0)

  movieIsPaused: Ref<boolean>
  movieResolution: Ref<Size>
  getClipTime: () => ClipTime
  getPresentationTime: () => ClipTime

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

    this.movieTime.value = currentTime

    this.videoEffect = options.videoEffect
    this.videoEffectIntensity = options.videoEffectIntensity
    this.source = options.source
    this.movieIsPaused = options.movieIsPaused
    this.movieResolution = options.movieResolution
    this.getClipTime = options.getClipTime
    this.getPresentationTime = options.getPresentationTime

    const { renderer } = options
    const { framebuffer, texture } = renderer.createFramebufferAndTexture()

    this.renderer = renderer
    this.mediaTexture = renderer.createTexture(FRAMEBUFFER_TEX_OPTIONS)
    this.framebuffer = framebuffer
    this.outTexture = texture
    this.updateSize()

    this._displayName = 'video-editor:CustomSourceNode'
  }

  updateSize() {
    const gl = this._gl
    const { width, height } = this.movieResolution.value

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

    const { media } = this

    if (!this.shouldRender || !media || isAudioElement(media)) return false

    this.updateSize()

    if (isElement(media)) {
      const { width, height } = getImageSize(media)
      if (!width || !height) return false
    }

    const { renderer } = this
    renderer.loadImage(this.mediaTexture, media)

    const gl = this._gl as WebGL2RenderingContext
    const resolution = this.movieResolution.value
    const coverSize = fit(this.mediaSize, resolution, 'cover')
    const transform = mat4.fromScaling(new Float32Array(16), [
      coverSize.width / resolution.width,
      coverSize.height / resolution.height,
      1,
    ])

    const isVideoFrame = 'codedWidth' in media && 'allocationSize' in media
    const rotation = this.source.video?.rotation ?? 0

    if (isVideoFrame || (IS_FIREFOX && rotation))
      mat4.rotateZ(transform, transform, (rotation * Math.PI) / 180)

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer)
    renderer.setSourceTexture(this.mediaTexture, resolution, this.mediaSize, undefined, false, transform)
    renderer.setEffect(this.videoEffect?.value)
    renderer.setIntensity(this.videoEffectIntensity?.value ?? 1)
    renderer.draw({ framebuffer: this.framebuffer })
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)

    return true
  }

  abstract _play(): void
  abstract _pause(): void

  destroy() {
    this.renderer.deleteTexture(this.mediaTexture)
    this.renderer.deleteTexture(this.outTexture)
    super.destroy()
  }
}
