import { DEFAULT_INTENSITY } from '@/constants'
import { EffectInternal } from '@/Effect'
import {
  Ref,
  computed,
  createEffectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  toValue,
  watch,
} from '@/framework/reactivity'
import { Renderer } from '@/engine/Renderer'
import {
  AdjustmentsState,
  Context2D,
  CropState,
  DisplayContext,
  ImageEditState,
  ImageSourceOption,
  Size,
  SyncImageSource,
} from '@/types'
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
} from '@/utils'

interface ImageSourceStateOptions {
  sourceOption: ImageSourceOption
  thumbnailSize: Ref<Size>
  renderer: Renderer
  effects: Ref<EffectInternal[]>
  onRenderPreview: () => void
  onEdit: (state: ImageEditState) => void
}

export class ImageSourceState {
  #renderer: Renderer
  #texture: WebGLTexture
  #original = ref<SyncImageSource>()
  #rotated = ref<SyncImageSource>()
  #previewSize = ref<Size>({ width: 1, height: 1 })
  #thumbnailSize!: Ref<Size>
  #isLoading = ref(true)
  #error = ref()
  #effects: Ref<EffectInternal[]>

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
    onRenderPreview,
    onEdit,
  }: ImageSourceStateOptions) {
    const currentScope = getCurrentScope()
    if (!currentScope) throw new Error(`[miru] ImageSource must be created within an EffectScope`)

    this.#renderer = renderer
    this.#texture = renderer.createTexture()!
    this.#effects = effects

    this.onRenderPreview = onRenderPreview

    this.context = createDisplayContext()
    const canvasSize = useElementSize(this.context.canvas)

    this.#previewSize = computed(() => {
      const size = canvasSize.value
      const rotated = this.#rotated.value

      // in the case where the container is hidden or not attached, draw at a fixed size
      const MIN_CONTAINER_SIZE = 200

      if (!rotated) return size

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

      return fullSize ? fit(fullSize, optionValue, 'contain') : optionValue
    })

    sourceOption = normalizeSourceOption(sourceOption)

    if (isSyncSource(sourceOption.source)) {
      const fullSizeImage = sourceOption.source

      if (devSlowDown) {
        devSlowDown()
          .then(() => (this.#original.value = fullSizeImage))
          .catch(() => undefined)
      } else this.#original.value = fullSizeImage
    } else {
      const { promise } = decodeAsyncImageSource(
        sourceOption.source,
        sourceOption.crossOrigin,
        sourceOption.isVideo,
      )

      ;(devSlowDown ? devSlowDown(promise) : promise)
        .then((decoded) => {
          this.#original.value = decoded
        })
        .catch((error) => {
          this.#error.value = error
        })
    }

    this.#scope.run(() => {
      // rotate the original image
      watch(
        [this.#original, () => this.crop.value?.rotate ?? 0, this.#error, this.pausePreview],
        ([original, rotation, error, paused]) => {
          if (paused > 0) return

          if (error) {
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

          if (!original || !rotation) {
            this.#rotated.value = original
            if (original) load(original)

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
      watch([this.#state], ([newState]) => onEdit(newState))

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

  #applyEditValuesToRenderer() {
    const renderer = this.#renderer

    renderer.setEffect(this.#effects.value[this.effect.value])
    renderer.setIntensity(this.intensity.value)
    renderer.setAdjustments(this.adjustments.value)
  }

  drawFullSize() {
    const rotated = this.#rotated.value
    if (this.isLoading || !rotated) return

    const renderer = this.#renderer
    const tempTexture = renderer.createTexture()!

    const crop = this.crop.value
    let cropped = rotated

    if (crop) {
      const context = get2dContext()
      resizeImageSync(rotated, crop, crop, context)
      cropped = context.canvas
    }

    try {
      const size = crop ?? rotated
      renderer.setSourceTexture(tempTexture, size, size)
      renderer.loadImage(tempTexture, cropped)
      this.#applyEditValuesToRenderer()

      renderer.draw()
    } finally {
      renderer.deleteTexture(tempTexture)
    }
  }

  async drawPreview(context: ImageBitmapRenderingContext | Context2D = this.context) {
    const rotated = this.#rotated.value
    if (this.isLoading || !rotated) return

    const renderer = this.#renderer
    renderer.setSourceTexture(this.#texture, this.#previewSize.value, rotated, this.crop.value)
    this.#applyEditValuesToRenderer()

    await renderer.drawAndTransfer(context)
    this.onRenderPreview?.()
  }

  async drawThumbnail(effect: EffectInternal, context: DisplayContext) {
    const rotated = this.#rotated.value
    if (this.isLoading || !rotated) return

    const renderer = this.#renderer

    renderer.setSourceTexture(this.#texture, this.#thumbnailSize.value, rotated, this.crop.value)
    renderer.setEffect(effect)
    // draw thumbnails at default intensity
    renderer.setIntensity(DEFAULT_INTENSITY)

    await renderer.drawAndTransfer(context)
  }

  dispose() {
    this.#scope.stop()
  }
}
