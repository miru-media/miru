import { ref } from 'fine-jsx'
import { Effect as BaseEffect, type EffectDefinition, type Renderer } from 'webgl-effects'

// eslint-disable-next-line import/no-relative-packages -- internal
import type { Effect as Effect_ } from '../webgl-effects/src/types/classes'

export class Effect implements Effect_ {
  readonly #effect: BaseEffect
  readonly #isLoading = ref(false)
  shaders: string[] = []

  get id() {
    return this.#effect.id ?? ''
  }
  get name() {
    return this.#effect.name
  }
  get ops() {
    return this.#effect.ops
  }
  get isDisposed() {
    return this.#effect.isDisposed
  }
  get promise() {
    return this.#effect.promise
  }
  get isLoading() {
    return this.#isLoading.value
  }

  constructor(definition: EffectDefinition, renderer: Renderer) {
    this.#effect = new BaseEffect(
      definition,
      renderer,
      ({ isLoading }) => (this.#isLoading.value = isLoading),
    )
  }

  toObject() {
    return this.#effect.toObject()
  }

  dispose() {
    this.#effect.dispose()
  }
}
