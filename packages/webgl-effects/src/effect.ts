import { Janitor, normalizeSourceOption } from 'shared/utils'

import { FRAGMENT_SHADERS } from './all-fragment-shaders'
import { type Renderer } from './renderer'
import { TextureResource } from './texture-resource'
import { type Effect as Effect_ } from './types/classes'
import { type AssetType, type EffectDefinition, type RendererEffectOp } from './types/core'

export class Effect implements Effect_ {
  id?: string
  name: string
  ops: RendererEffectOp[]
  isDisposed = false
  isLoading = false
  private janitor = new Janitor()
  private resources: TextureResource[]
  private shaders: string[] = []
  private definition: EffectDefinition

  get promise() {
    return this.resources.length ? Promise.all(this.resources.map((t) => t.promise)) : undefined
  }

  constructor(definition: EffectDefinition, renderer: Renderer, onStateChange?: (effect: Effect) => void) {
    const { id, name, ops } = definition

    this.definition = definition
    this.id = id
    this.name = name
    const resources: TextureResource[] = (this.resources = [])
    const uniforms: NonNullable<RendererEffectOp['uniforms']> = {}

    const onResourceStateChange = () => {
      this.isLoading = this.resources.some((r) => r.isLoading)
      onStateChange?.(this)
    }
    const createTexture = (source: string, type?: AssetType) => {
      const resource = new TextureResource(
        normalizeSourceOption(source, type),
        renderer,
        onResourceStateChange,
      )
      resources.push(resource)
      return resource.texture
    }

    this.ops = ops.map((op) => {
      let fragmentShader: string

      switch (op.type) {
        case 'shader':
          for (const key in op.properties) {
            const value = op.properties[key]
            if (typeof value !== 'number' && 'type' in value)
              uniforms[key] = createTexture(value.source, value.type)
            else uniforms[key] = value
          }

          fragmentShader = op.fragmentShader
          break
        case 'lut': {
          const { lut } = op
          uniforms.lut = typeof lut === 'string' ? createTexture(lut) : createTexture(lut.source, lut.type)
          fragmentShader = FRAGMENT_SHADERS.lut
          break
        }
        case 'vignette':
          fragmentShader = FRAGMENT_SHADERS.vignette
          break
        case 'film_grain':
          fragmentShader = FRAGMENT_SHADERS.film_grain
          break
        case 'adjust_color':
          uniforms.brightness = op.brightness
          uniforms.contrast = op.contrast
          uniforms.saturation = op.saturation
          fragmentShader = FRAGMENT_SHADERS.adjust_color
          break
        case 'sepia':
          fragmentShader = FRAGMENT_SHADERS.sepia
          break
        case 'hue_rotate':
          uniforms.angle = op.angle
          fragmentShader = FRAGMENT_SHADERS.hue_rotate
          break
        case 'chromatic_aberration':
          uniforms.red = op.red
          uniforms.blue = op.blue
          uniforms.green = op.green
          fragmentShader = FRAGMENT_SHADERS.chromatic_aberration
          break
      }

      this.shaders.push(fragmentShader)

      return {
        programInfo: renderer.getProgram(fragmentShader),
        intensity: op.intensity ?? 1,
        uniforms,
      }
    })

    this.janitor.add(() => {
      this.resources.forEach((r) => r.janitor.dispose())
      this.shaders.forEach((s) => renderer.dropProgram(s))
      this.resources.length = this.shaders.length = 0

      this.isDisposed = true
    })
  }

  toObject(): EffectDefinition {
    return this.definition
  }

  dispose() {
    this.janitor.dispose()
  }
}
