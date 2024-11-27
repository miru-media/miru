import { type EffectInternal } from 'reactive-effects/Effect'
import { type Renderer } from 'renderer/Renderer'
import {
  computed,
  createEffectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  type Ref,
  toValue,
  watch,
} from 'shared/framework/reactivity'
import {
  type AdjustmentsState,
  type Context2D,
  type CropState,
  type DisplayContext,
  type ImageEditState,
  type ImageSourceOption,
  type RendererEffectOp,
  type Size,
  type SyncImageSource,
} from 'shared/types'
import {
  createDisplayContext,
  decodeAsyncImageSource,
  devSlowDown,
  drawImage,
  editIsEqualTo,
  fit,
  fitToWidth,
  get2dContext,
  isSyncSource,
  normalizeSourceOption,
  resizeImageSync,
  useElementSize,
  win,
} from 'shared/utils'

import { DEFAULT_INTENSITY } from './constants'

interface ImageSourceInternalOptions {
  sourceOption: ImageSourceOption
  thumbnailSize: Ref<Size>
  renderer: Renderer
  effects: Ref<EffectInternal[]>
  adjustColorOp: RendererEffectOp
  onRenderPreview: () => void
  onEdit: (state: ImageEditState) => void
}

export class ImageSourceInternal {
  #renderer: Renderer
  #texture: WebGLTexture
  #original = ref<SyncImageSource>()
  #rotated = ref<SyncImageSource>()
  #previewSize = ref<Size>({ width: 1, height: 1 })
  #thumbnailSize!: Ref<Size>
  #isLoading = ref(true)
  #error = ref()
  #effects: Ref<EffectInternal[]>
  #adjustColorOp: RendererEffectOp

  previewKey = ref(0)
  thumbnailKey = ref(0)

  context: ReturnType<typeof createDisplayContext>
  effect = ref(-1)
  intensity = ref(DEFAULT_INTENSITY)
  crop = ref<CropState>()
  adjustments = ref<AdjustmentsState>()
  #state = computed(
    (): ImageEditState => ({
      effect: this.effect.value,
      intensity: this.intensity.value,
      crop: this.crop.value,
      adjustments: this.adjustments.value,
    }),
    editIsEqualTo,
  )

  pausePreview = ref(0)
  onRenderPreview?
  forceResize = ref(false)

  #scope = createEffectScope()

  get isLoading() {
    return this.#isLoading.value
  }

  get original() {
    return this.#original.value
  }

  constructor({
    sourceOption,
    thumbnailSize,
    renderer,
    effects,
    adjustColorOp,
    onRenderPreview,
    onEdit,
  }: ImageSourceInternalOptions) {
    const currentScope = getCurrentScope()
    if (currentScope == undefined) throw new Error(`[miru] ImageSource must be created within an EffectScope`)

    this.#renderer = renderer
    this.#texture = renderer.createTexture()!
    this.#effects = effects
    this.#adjustColorOp = adjustColorOp

    this.onRenderPreview = onRenderPreview

    this.context = createDisplayContext()
    const canvasSize = useElementSize(this.context.canvas)

    this.#previewSize = computed(() => {
      const size = canvasSize.value
      const rotated = this.#rotated.value

      // in the case where the container is hidden or not attached, draw at a fixed size
      const MIN_CONTAINER_SIZE = 200

      if (rotated == undefined) return size

      const dpr = win.devicePixelRatio
      const containerSize = {
        width: Math.max(size.width, MIN_CONTAINER_SIZE) * dpr,
        height: Math.max(size.height, MIN_CONTAINER_SIZE) * dpr,
      }

      const cropSize = this.crop.value ?? rotated

      return fit(
        // fit to just the containerSize can cause an infinite layout loop
        // so instead fit to the width of the contianer
        fitToWidth(cropSize, containerSize),
        // then limit to the minimum of the image size and window size
        {
          width: Math.min(cropSize.width, window.innerWidth * dpr),
          height: Math.min(cropSize.height, window.innerHeight * dpr),
        },
      )
    })

    this.#thumbnailSize = computed(() => {
      const optionValue = toValue(thumbnailSize)
      const fullSize = this.crop.value ?? this.#rotated.value

      return fullSize != undefined ? fit(fullSize, optionValue, 'contain') : optionValue
    })

    sourceOption = normalizeSourceOption(sourceOption)

    if (isSyncSource(sourceOption.source)) {
      const fullSizeImage = sourceOption.source

      if (devSlowDown != undefined) {
        devSlowDown()
          .then(() => (this.#original.value = fullSizeImage))
          .catch(() => undefined)
      } else this.#original.value = fullSizeImage
    } else {
      const { promise } = decodeAsyncImageSource(
        sourceOption.source,
        sourceOption.crossOrigin,
        sourceOption.type === 'video',
      )

      ;(devSlowDown != undefined ? devSlowDown(promise) : promise)
        .then((decoded) => {
          this.#original.value = decoded
        })
        .catch((error: unknown) => {
          this.#error.value = error
        })
    }

    this.#scope.run(() => {
      // rotate the original image
      watch(
        [this.#original, () => this.crop.value?.rotate ?? 0, this.#error, this.pausePreview],
        ([original, rotation, error, paused]) => {
          if (paused > 0) return

          if (error != undefined) {
            this.#isLoading.value = false
            this.#original.value = this.#rotated.value = undefined
            return
          }

          const load = (image: SyncImageSource) => {
            this.#renderer.loadImage(this.#texture, image)
            this.#isLoading.value = false
            this.previewKey.value++
          }

          this.#isLoading.value = true

          if (original == undefined || !rotation) {
            this.#rotated.value = original
            if (original != undefined) load(original)

            return
          }

          const context = get2dContext()
          const { canvas } = context

          if ((rotation / 90) % 2 === 0) {
            canvas.width = original.width
            canvas.height = original.height
          } else {
            canvas.width = original.height
            canvas.height = original.width
          }

          context.save()

          context.translate(canvas.width / 2, canvas.height / 2)
          context.rotate((rotation * Math.PI) / 180)
          drawImage(context, original, -original.width / 2, -original.height / 2)
          context.restore()

          this.#rotated.value = canvas
          load(canvas)
        },
      )

      watch(
        [
          this.intensity,
          this.effect,
          this.adjustments,
          this.#previewSize,
          this.#isLoading,
          this.pausePreview,
        ],
        () => this.previewKey.value++,
      )

      watch([this.previewKey], () => this.drawPreview())

      watch(
        [this.#rotated, this.#thumbnailSize, this.adjustments, this.crop, this.#isLoading, this.pausePreview],
        () => this.thumbnailKey.value++,
      )

      // emit edit on state change
      watch([this.#state], ([newState]) => this.#scope.active && onEdit(newState))

      onScopeDispose(() => {
        renderer.deleteTexture(this.#texture)
        this.#renderer = undefined as never
        this.#original.value = this.#rotated.value = undefined
        this.#texture = this.context = this.onRenderPreview = undefined as never
      })
    })
  }

  getState() {
    return this.#state.value
  }
  setState({ effect, intensity, crop }: ImageEditState) {
    this.effect.value = effect
    this.intensity.value = intensity
    this.crop.value = crop
  }

  #applyEditValuesToRenderer(effect?: EffectInternal, adjustments?: AdjustmentsState) {
    const renderer = this.#renderer

    const ops = effect?.ops.slice() ?? []
    if (adjustments) {
      Object.assign(this.#adjustColorOp.uniforms, adjustments)
      ops.unshift(this.#adjustColorOp)
    }

    renderer.setEffect({ ops })
    renderer.setIntensity(this.intensity.value)
  }

  drawFullSize() {
    const rotated = this.#rotated.value
    if (this.isLoading || rotated == undefined) return

    const renderer = this.#renderer
    const tempTexture = renderer.createTexture()

    const crop = this.crop.value
    let cropped = rotated

    if (crop != undefined) {
      const context = get2dContext()
      resizeImageSync(rotated, crop, crop, context)
      cropped = context.canvas
    }

    try {
      const size = crop ?? rotated
      renderer.setSourceTexture(tempTexture, size, size)
      renderer.loadImage(tempTexture, cropped)
      this.#applyEditValuesToRenderer(this.#effects.value[this.effect.value], this.adjustments.value)

      renderer.clear()
      renderer.draw()
    } finally {
      renderer.deleteTexture(tempTexture)
    }
  }

  async drawPreview(context: ImageBitmapRenderingContext | Context2D = this.context) {
    const rotated = this.#rotated.value
    if (this.isLoading || rotated == undefined) return

    const renderer = this.#renderer
    renderer.setSourceTexture(this.#texture, this.#previewSize.value, rotated, this.crop.value)
    this.#applyEditValuesToRenderer(this.#effects.value[this.effect.value], this.adjustments.value)

    renderer.clear()
    await renderer.drawAndTransfer(context)
    if (!this.#scope.active) return

    this.onRenderPreview?.()
  }

  async drawThumbnail(effect: EffectInternal, context: DisplayContext) {
    const rotated = this.#rotated.value
    if (this.isLoading || rotated == undefined) return

    const renderer = this.#renderer

    renderer.setSourceTexture(this.#texture, this.#thumbnailSize.value, rotated, this.crop.value)
    this.#applyEditValuesToRenderer(effect, this.adjustments.value)
    // draw thumbnails at default intensity
    renderer.setIntensity(DEFAULT_INTENSITY)

    renderer.clear()
    await renderer.drawAndTransfer(context)
  }

  dispose() {
    this.#scope.stop()
    this.#adjustColorOp = undefined as never
  }
}
