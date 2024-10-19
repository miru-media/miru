import { Renderer } from '@/engine/Renderer'
import { Context2D, Effect, RendererEffectOp } from '@/types'
import { TextureResource } from './TextureResource'
import { Janitor, normalizeSourceOption } from './utils'
import { Ref, computed } from './framework/reactivity'
import { MAX_EFFECT_TEXTURES } from './constants'

export class EffectInternal {
  renderer: Renderer
  name: string
  ops: RendererEffectOp[]
  isDisposed = false
  images: WebGLTexture[]
  luts: WebGLTexture[]
  janitor = new Janitor()
  isLoading: Ref<boolean>
  resources: TextureResource[]
  get promise() {
    return this.resources.length ? Promise.all(this.resources.map((t) => t.promise)) : undefined
  }

  constructor(info: Effect, renderer: Renderer, scratchpad: Context2D) {
    const { name, ops } = info

    this.renderer = renderer
    this.name = name
    const images: WebGLTexture[] = (this.images = [])
    const luts: WebGLTexture[] = (this.luts = [])
    const resources: TextureResource[] = (this.resources = [])
    this.isLoading = this.isLoading = computed(() => this.resources.some((r) => r.isLoading.value))

    this.ops = ops.map((op) => {
      let lutIndex = -1
      let imageIndex = -1

      if (op.image) {
        const resource = new TextureResource(normalizeSourceOption(op.image, false), renderer, scratchpad)
        resources.push(resource)

        imageIndex = images.length
        images.push(resource.texture)
      }

      if (op.lut) {
        const resource = new TextureResource(normalizeSourceOption(op.lut, true), renderer, scratchpad)
        resources.push(resource)

        lutIndex = luts.length
        luts.push(resource.texture)
      }

      return {
        ...op,
        intensity: op.intensity ?? 1,
        image: imageIndex,
        lut: lutIndex,
      }
    })

    if (resources.length > MAX_EFFECT_TEXTURES)
      throw new Error(`[miru] texture count of ${resources.length} exceeds max of ${MAX_EFFECT_TEXTURES}`)

    this.janitor.add(() => {
      this.resources.forEach((r) => r.janitor.dispose())
      this.resources.length = this.images.length = this.luts.length = 0

      this.renderer = undefined as never

      this.isDisposed = true
    })
  }
}
