import etro from 'etro'
import { type Ref, ref } from 'fine-jsx'
import { type Renderer } from 'webgl-effects'

import { type Effect } from 'reactive-effects/Effect'

import { type EtroVideo } from './EtroVideo'

export class EtroEffect extends etro.effect.Visual {
  #renderer: Renderer
  effect: Ref<Effect | undefined>
  intensity = ref(1)

  // TODO: dispose

  constructor({ effect, renderer }: { effect: Effect; renderer: Renderer }) {
    super()
    this.#renderer = renderer
    this.effect = ref(effect)
  }

  apply(target: etro.layer.VisualSource & Partial<EtroVideo>, _reltime: number) {
    if (this.effect.value == undefined || target.__m_isEtroVideo !== true) return

    const renderer = this.#renderer

    // WIP: render.setSourceTexture(framebufferTextureOrSomething)
    renderer.setEffect(this.effect.value)
    renderer.setIntensity(this.intensity.value)
    renderer.draw()
  }

  get ready() {
    return this.effect.value?.isLoading === false
  }

  async whenReady() {
    await Promise.resolve(this.effect.value?.promise)
  }
}
