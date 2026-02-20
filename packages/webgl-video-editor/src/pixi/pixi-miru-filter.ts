import type { Ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'
import type { EffectOp } from 'webgl-effects'

// eslint-disable-next-line import/no-unresolved -- glob
import * as _frags from '../glsl/*.frag'
import ADJUST_COLOR from '../glsl/adjust-color.frag'
import VERTEX_SHADER from '../glsl/default.vert'

import { LutSource } from './pixi-lut-source.ts'

const FRAGMENT_SHADERS = _frags as unknown as Record<EffectOp['type'], string>

export class MiruFilter extends Pixi.Filter implements Pick<Pixi.Filter, 'resources'> {
  readonly op: EffectOp
  readonly opIntensity: number
  readonly sprites: Pixi.Sprite[]

  public enabled = true
  readonly #intensity: Ref<number>

  readonly #getIsLoading?: () => boolean
  get isLoading(): boolean {
    return this.#getIsLoading?.() === true
  }

  constructor(op: EffectOp, intensity: Ref<number>) {
    const expandedOp = expandOp(op)

    super({ glProgram: Pixi.GlProgram.from(expandedOp), resources: expandedOp.resources })

    this.op = op
    this.#intensity = intensity
    this.sprites = expandedOp.sprites
    this.opIntensity = op.intensity ?? 1
    this.#getIsLoading = expandedOp.getIsLoading
  }

  apply(
    filterManager: Pixi.FilterSystem,
    input: Pixi.Texture,
    output: Pixi.RenderSurface,
    clearMode: boolean,
  ): void {
    this.resources.filterUniforms.uniforms.u_intensity = this.opIntensity * this.#intensity.value

    super.apply(filterManager, input, output, clearMode)
  }

  destroy(): void {
    this.sprites.forEach((t) => t.destroy(true))
    this.sprites.length = 0
  }
}

const expandOp = (op: EffectOp) => {
  let fragmentShader: string
  const intensity = op.intensity ?? 1
  const uniforms: Record<string, any> = { u_intensity: { type: 'f32', value: intensity } }
  const resources: Record<string, any> = {}
  const sprites: Pixi.Sprite[] = []
  let getIsLoading: (() => boolean) | undefined

  fragmentShader = ADJUST_COLOR

  switch (op.type) {
    case 'lut': {
      const lutSource = new LutSource(op.lut)
      const sprite = new Pixi.Sprite({
        texture: new Pixi.Texture({ source: lutSource }),
        visible: false,
      })
      sprites.push(sprite)

      resources.lut = sprite.texture.source
      fragmentShader = FRAGMENT_SHADERS.lut
      getIsLoading = () => lutSource.isLoading
      break
    }
    case 'vignette':
      fragmentShader = FRAGMENT_SHADERS.vignette
      break
    case 'film_grain':
      fragmentShader = FRAGMENT_SHADERS.film_grain
      break
    case 'adjust_color':
      uniforms.brightness = { type: 'f32', value: op.brightness }
      uniforms.contrast = { type: 'f32', value: op.contrast }
      uniforms.saturation = { type: 'f32', value: op.saturation }
      fragmentShader = FRAGMENT_SHADERS.adjust_color
      break
    case 'sepia':
      fragmentShader = FRAGMENT_SHADERS.sepia
      break
    case 'hue_rotate':
      uniforms.angle = { type: 'f32', value: op.angle }
      fragmentShader = FRAGMENT_SHADERS.hue_rotate
      break
    case 'chromatic_aberration':
      uniforms.red = { type: 'f32', value: op.red }
      uniforms.blue = { type: 'f32', value: op.blue }
      uniforms.green = { type: 'f32', value: op.green }
      fragmentShader = FRAGMENT_SHADERS.chromatic_aberration
      break
    default: {
      throw new Error(`[webgl-video-editor]: Unexpected op type "${op.type}".`)
    }
  }

  return {
    vertex: VERTEX_SHADER,
    fragment: fragmentShader,
    intensity,
    resources: { ...resources, filterUniforms: new Pixi.UniformGroup(uniforms) },
    getIsLoading,
    sprites,
  }
}
