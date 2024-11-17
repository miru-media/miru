import etro from 'etro'

import { ref, type Ref } from '@/framework/reactivity'
import { useEventListener } from '@/utils'

import { type EffectInternal } from '../reactive-effects/Effect'
import { type Renderer } from '../renderer/Renderer'

import { EtroEffect } from './EtroEffect'
import { useMappedUniqueArray, useMediaError, useMediaReadyState } from './utils'

export class EtroVideo extends etro.layer.Video {
  #effects = ref<EtroEffect[]>([])
  #texture: WebGLTexture
  #renderer: Renderer
  readyState: Ref<number>
  error: Ref<MediaError | undefined>
  latestEvent = ref<Event>()

  __m_isEtroVideo = true

  get effects() {
    return this.#effects.value
  }
  set effects(_value) {
    // noop
  }

  cctx = {
    drawImage() {
      // noop
    },
  }

  get ready() {
    return this.readyState.value >= 3 || super.ready
  }

  constructor(options: etro.layer.VideoOptions, effects: Ref<EffectInternal[]>, renderer: Renderer) {
    super(options)

    // Object.assign(this.source.style, { width: '200px', height: '200px', border: 'solid' })
    this.#renderer = renderer
    this.#effects = useMappedUniqueArray(
      effects,
      (effect) => {
        const etroEffect = new EtroEffect({ effect, renderer })
        etroEffect.attach(this as etro.layer.Base)
        return etroEffect
      },
      (etroEffect) => etroEffect.detach(),
    )
    this.#texture = renderer.createTexture()
    this.readyState = useMediaReadyState(this.source)
    this.error = useMediaError(this.source)

    const allEventTypes = [
      'abort',
      'canplay',
      'canplaythrough',
      'durationchange',
      'emptied',
      'encrypted',
      'ended',
      'error',
      'loadeddata',
      'loadedmetadata',
      'loadstart',
      'pause',
      'play',
      'playing',
      'progress',
      'ratechange',
      'seeked',
      'seeking',
      'stalled',
      'suspend',
      'timeupdate',
      'volumechange',
      'waiting',
    ]
    allEventTypes.forEach((type) =>
      useEventListener(this.source, type, (event) => (this.latestEvent.value = event)),
    )
  }

  async whenReady() {
    if (this.ready) return
    return new Promise<void>((resolve) =>
      this.source.addEventListener('canplay', () => resolve(), { once: true }),
    )
  }

  doRender() {
    const renderer = this.#renderer
    const { videoWidth, videoHeight } = this.source
    renderer.loadImage(this.#texture, this.source)
    renderer.setSourceTexture(this.#texture, this.movie, { width: videoWidth, height: videoHeight })
    // WIP: draw to framebuffer
    renderer.draw()
    renderer.setEffect(undefined)
    renderer.setIntensity(0)
    renderer.setAdjustments(undefined)
  }
}
