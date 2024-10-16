import { DEFAULT_INTENSITY } from '@/constants'
import { EffectInternal } from '@/Effect'
import { Ref, computed, getCurrentScope, onScopeDispose, ref, toValue, watch } from '@/framework/reactivity'
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
  Janitor,
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
  context?: ImageSourceState['context']
  renderer: Renderer
  effects: Ref<EffectInternal[]>
  onRenderPreview: () => void
  onEdit: (state: ImageEditState) => void
}

export class ImageSourceState {
  #renderer: Renderer
  #texture: WebGLTexture
  #thumbnailTexture: WebGLTexture
  #original = ref<SyncImageSource>()
  #rotated = ref<SyncImageSource>()
  #previewContext = get2dContext()
  #thumbnailContext = get2dContext(document.createElement('canvas'))
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

  janitor = new Janitor()

  get isLoading() {
    return this.#isLoading.value
  }

  get original() {
    return this.#original.value
  }

  get previewSize() {
    return this.#previewSize.value
  }

  get thumbnailCanvas() {
    return this.#thumbnailContext.canvas
  }

  constructor({
    sourceOption,
    thumbnailSize,
    context,
    renderer,
    effects,
    onRenderPreview,
    onEdit,
  }: ImageSourceStateOptions) {
    const currentScope = getCurrentScope()
    if (!currentScope) throw new Error(`[miru] ImageSource must be created within an EffectScope`)

    this.#renderer = renderer
    this.#texture = renderer.createTexture()!
    this.#thumbnailTexture = renderer.createTexture()!
    this.#effects = effects

    this.context = context ?? createDisplayContext()

    this.onRenderPreview = onRenderPreview

    const canvasSize = useElementSize(this.context.canvas)

    this.#previewSize = computed(() => {
      const size = canvasSize.value
      const rotated = this.#rotated.value

      // in the case where the container is hidden or not attached, draw at a fixed size
      const MIN_CONTAINER_SIZE = 200

      if (!rotated) return size

      const dpr = win.devicePixelRatio

      return fitToWidth(this.crop.value ?? rotated, {
        width: Math.max(size.width, MIN_CONTAINER_SIZE) * dpr,
        height: Math.max(size.height, MIN_CONTAINER_SIZE) * dpr,
      })
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
      const { promise } = decodeAsyncImageSource(sourceOption.source, sourceOption.crossOrigin)

      ;(devSlowDown ? devSlowDown(promise) : promise)
        .then((decoded) => {
          this.#original.value = decoded
        })
        .catch((error) => {
          this.#error.value = error
        })
    }

    // rotate the original image
    watch([this.#original, () => this.crop.value?.rotate, this.#error], ([original, rotation, error]) => {
      if (error) {
        this.#isLoading.value = false
        this.#original.value = undefined
        return
      }

      if (!original) this.#isLoading.value = true

      if (!original || !rotation) {
        this.#rotated.value = original
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
    })

    // crop rotated image and resize if larger than the screen size
    watch(
      [this.#rotated, this.crop, this.adjustments, this.pausePreview],
      ([fullSizeImage, crop, _adjustments, pause]) => {
        if (pause > 0) return

        if (!fullSizeImage) {
          this.#isLoading.value = true
          return
        }

        const { canvas } = this.#previewContext
        let previewTextureSize: Size = crop ?? fullSizeImage
        const dpr = win.devicePixelRatio
        const screenSize = {
          width: screen.width * dpr,
          height: screen.width * dpr,
        }

        if (previewTextureSize.width > screenSize.width || previewTextureSize.height > screenSize.height)
          previewTextureSize = fit(previewTextureSize, screenSize)

        resizeImageSync(fullSizeImage, crop, previewTextureSize, this.#previewContext)

        this.#renderer.loadImage(this.#texture, canvas)
        this.#isLoading.value = false
        this.previewKey.value++
      },
    )

    // resize preview image to thumbnail size
    watch([this.#thumbnailSize, this.previewKey, this.crop], ([size]) => {
      if (this.#isLoading.value) return

      const { canvas } = this.#thumbnailContext
      resizeImageSync(this.#previewContext.canvas, undefined, size, this.#thumbnailContext)

      this.#renderer.loadImage(this.#thumbnailTexture, canvas)
      this.thumbnailKey.value++
    })

    // draw preview on effect change
    watch(
      [this.previewKey, this.intensity, this.effect, this.adjustments, this.#previewSize, this.#isLoading],
      () => this.drawPreview(),
    )

    // emit edit on state change
    watch([this.#state], ([newState]) => onEdit(newState))

    this.janitor.add(() => {
      renderer.deleteTexture(this.#texture)
      this.#renderer = undefined as never
      this.#original.value = this.#rotated.value = undefined
      this.#previewContext = this.#thumbnailContext = undefined as never
      this.#texture = this.#thumbnailTexture = this.context = this.onRenderPreview = undefined as never
    })

    onScopeDispose(() => this.janitor.dispose())
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
    renderer.setSourceTexture(this.#texture, this.#previewSize.value, this.crop.value ?? rotated)
    this.#applyEditValuesToRenderer()

    await renderer.drawAndTransfer(context)
    this.onRenderPreview?.()
  }

  async drawThumbnail(effect: EffectInternal, context: DisplayContext) {
    const rotated = this.#rotated.value
    if (this.isLoading || !rotated) return

    const renderer = this.#renderer

    renderer.setSourceTexture(this.#thumbnailTexture, this.#thumbnailSize.value, this.crop.value ?? rotated)
    renderer.setEffect(effect)
    // draw thumbnails at default intensity
    renderer.setIntensity(DEFAULT_INTENSITY)

    await renderer.drawAndTransfer(context)
  }
}
