import VideoContext, { type RenderGraph } from 'videocontext'

import { FRAMEBUFFER_TEX_OPTIONS } from '@/constants'
import { type EffectInternal } from '@/Effect'
import * as GL from '@/GL'
import fragmentShader from '@/renderer/glsl/main.frag'
import vertexShader from '@/renderer/glsl/main.vert'
import { type Renderer } from '@/renderer/Renderer'
import { type AdjustmentsState, type Size } from '@/types'
import { setObjectSize } from '@/utils'

export const definition = {
  title: 'Miru Filter',
  description: 'Miru image filters',
  vertexShader,
  fragmentShader,
  properties: {
    u_intensity: { type: 'uniform', value: 1 },
  },
  inputs: ['u_image', 'u_image_b'],
}

export class MiruVideoNode extends VideoContext.NODES.VideoNode {
  #media: HTMLVideoElement
  #renderer: Renderer
  #mediaTexture: WebGLTexture
  #outTexture: WebGLTexture
  #framebuffer: WebGLFramebuffer
  #framebufferSize: Size = { width: 1, height: 1 }

  declare _texture: WebGLTexture
  declare _gl: WebGL2RenderingContext
  declare _startTime: number

  effect?: EffectInternal
  intensity = 1
  adjustments: AdjustmentsState = { brightness: 0, contrast: 0, saturation: 0 }

  constructor(
    src: HTMLVideoElement,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,
    sourceOffset: number,
    preloadTime: number,
    { renderer }: { renderer: Renderer },
  ) {
    super(src, gl, renderGraph, currentTime, 1, sourceOffset, preloadTime, undefined)

    this.#media = src
    this.#renderer = renderer
    this.#mediaTexture = this._texture
    this.#outTexture = renderer.createTexture(FRAMEBUFFER_TEX_OPTIONS)

    this.#updateSize()

    this.#framebuffer = gl.createFramebuffer()!
    gl.bindFramebuffer(GL.FRAMEBUFFER, this.#framebuffer)
    gl.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, this.#outTexture, 0)
    gl.bindFramebuffer(GL.FRAMEBUFFER, null)

    this._displayName = 'MiruVideoNode'
  }

  #updateSize() {
    const gl = this._gl
    const { width, height } = gl.canvas

    if (width === this.#framebufferSize.width && height === this.#framebufferSize.height) return

    setObjectSize(this.#framebufferSize, gl.canvas)
    gl.bindTexture(GL.TEXTURE_2D, this.#outTexture)
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, width, height, 0, GL.RGBA, GL.UNSIGNED_BYTE, null)
  }

  _update(currentTime: number, triggerTextureUpdate = true) {
    this.#updateSize()

    const renderer = this.#renderer
    const gl = this._gl
    const mediaSize = { width: this.#media.videoWidth, height: this.#media.videoHeight }

    this._texture = this.#mediaTexture
    const superUpdated = super._update(currentTime, triggerTextureUpdate)

    const isBeforeStart = currentTime < this._startTime
    const shouldRender = triggerTextureUpdate && superUpdated && !isBeforeStart

    if (shouldRender) {
      gl.bindTexture(GL.TEXTURE_2D, this.#outTexture)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.#framebuffer)
      gl.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, this.#outTexture, 0)

      renderer.setSourceTexture(this.#mediaTexture, gl.canvas, mediaSize, undefined, true)
      renderer.setEffect(this.effect)
      renderer.setIntensity(this.intensity)
      renderer.setAdjustments(this.adjustments)
      renderer.draw()
      this._texture = this.#outTexture
    }

    return true
  }

  _seek(time: number) {
    // avoid resizing the framebuffer texture
    this._texture = this.#mediaTexture
    super._seek(time)
    this._texture = this.#outTexture
  }

  destroy() {
    this.#renderer.deleteTexture(this.#mediaTexture)
    this.#renderer.deleteTexture(this.#outTexture)
    this.#renderer = undefined as never
    super.destroy()
  }
}
