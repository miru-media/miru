import etro from 'etro'
import { type Ref, ref } from 'fine-jsx'

import { type EffectInternal } from 'reactive-effects/Effect'
import { type Renderer } from 'renderer/Renderer'

import { type EtroVideo } from './EtroVideo'

export class EtroEffect extends etro.effect.Visual {
  #renderer: Renderer
  effect: Ref<EffectInternal | undefined>
  intensity = ref(1)

  // TODO: dispose

  constructor({ effect, renderer }: { effect: EffectInternal; renderer: Renderer }) {
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
    return this.effect.value?.isLoading.value === false
  }

  async whenReady() {
    await Promise.resolve(this.effect.value?.promise)
  }
}
