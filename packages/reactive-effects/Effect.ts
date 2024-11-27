import { FRAGMENT_SHADERS } from 'renderer/allFragmentShaders'
import { type Renderer } from 'renderer/Renderer'
import { computed, type Ref } from 'shared/framework/reactivity'
import { type AssetType, type Effect, type RendererEffectOp } from 'shared/types'
import { Janitor, normalizeSourceOption } from 'shared/utils'

import { TextureResource } from './TextureResource'

export class EffectInternal {
  renderer: Renderer
  name: string
  ops: RendererEffectOp[]
  isDisposed = false
  janitor = new Janitor()
  isLoading: Ref<boolean>
  resources: TextureResource[]
  shaders: string[] = []
  get promise() {
    return this.resources.length ? Promise.all(this.resources.map((t) => t.promise)) : undefined
  }

  constructor(info: Effect, renderer: Renderer) {
    const { name, ops } = info

    this.renderer = renderer
    this.name = name
    const resources: TextureResource[] = (this.resources = [])
    const uniforms: NonNullable<RendererEffectOp['uniforms']> = {}
    this.isLoading = this.isLoading = computed(() => this.resources.some((r) => r.isLoading.value))

    const createTexture = (source: string, type?: AssetType) => {
      const resource = new TextureResource(normalizeSourceOption(source, type), renderer)
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

      this.renderer = undefined as never

      this.isDisposed = true
    })
  }
}
