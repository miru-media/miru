import {
  computed,
  createEffectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  type Ref,
  toValue,
  watch,
} from 'fine-jsx'
import type { Context2D, CropState, Renderer, RendererDrawOptions, RendererEffectOp } from 'webgl-effects'

import type { Effect } from 'reactive-effects/effect'
import type { AdjustmentsState, ImageEditState, ImageSourceOption, Size, SyncImageSource } from 'shared/types'
import {
  createDisplayContext,
  devSlowDown,
  drawImage,
  editIsEqualTo,
  fit,
  fitToWidth,
  get2dContext,
  isSyncSource,
  loadAsyncImageSource,
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
  effects: Ref<Map<string, Effect>>
  adjustColorOp: RendererEffectOp
  manualUpdate: boolean
  onRenderPreview: () => void
  onEdit: (state: ImageEditState) => void
}

export class ImageSourceInternal {
  #renderer: Renderer
  #texture: WebGLTexture
  readonly #original = ref<SyncImageSource>()
  readonly #rotated = ref<SyncImageSource>()
  readonly #previewSize = ref<Size>({ width: 1, height: 1 })
  readonly #thumbnailSize!: Ref<Size>
  readonly #isLoading = ref(true)
  readonly #error = ref()
  readonly #effects: Ref<Map<string, Effect>>
  #adjustColorOp: RendererEffectOp

  previewKey = ref(0)
  thumbnailKey = ref(0)

  context: CanvasRenderingContext2D
  effect = ref<string>()
  intensity = ref(DEFAULT_INTENSITY)
  crop = ref<CropState>()
  adjustments = ref<AdjustmentsState>()
  readonly #state = computed(
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

  readonly #scope = createEffectScope()

  get isLoading() {
    return this.#isLoading.value
  }

  get original() {
    return this.#original.value
  }

  get rotated() {
    return this.#rotated.value
  }

  get texture() {
    return this.#texture
  }

  get thunmbnailSize() {
    return this.#thumbnailSize.value
  }

  constructor({
    sourceOption,
    thumbnailSize,
    renderer,
    effects,
    adjustColorOp,
    manualUpdate,
    onRenderPreview,
    onEdit,
  }: ImageSourceInternalOptions) {
    const currentScope = getCurrentScope()
    if (currentScope == null)
      throw new Error(`[webgl-media-editor] ImageSource must be created within an EffectScope`)

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

      if (rotated == null) return size

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

      return fullSize != null ? fit(fullSize, optionValue, 'contain') : optionValue
    })

    sourceOption = normalizeSourceOption(sourceOption)

    if (isSyncSource(sourceOption.source)) {
      const fullSizeImage = sourceOption.source

      if (devSlowDown != null) {
        devSlowDown()
          .then(() => (this.#original.value = fullSizeImage))
          .catch(() => undefined)
      } else this.#original.value = fullSizeImage
    } else {
      const { promise } = loadAsyncImageSource(
        sourceOption.source,
        sourceOption.crossOrigin,
        sourceOption.type === 'video',
      )

      ;(devSlowDown != null ? devSlowDown(promise) : promise)
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
        [this.pausePreview, this.#error, this.#original, () => this.crop.value?.rotate ?? 0],
        ([paused, error]) => {
          if (error != null) {
            this.#isLoading.value = false
            this.#original.value = this.#rotated.value = undefined
            return
          }

          if (paused > 0) return

          this.#rotateOriginal()
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

      if (!manualUpdate) watch([this.previewKey], () => this.drawPreview())

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

  #rotateOriginal() {
    const original = this.#original.value
    const rotation = this.crop.value?.rotate ?? 0

    const load = (image: SyncImageSource) => {
      this.#renderer.loadImage(this.#texture, image)
      this.previewKey.value++
    }

    this.#isLoading.value = original == null

    if (original == null || !rotation) {
      this.#rotated.value = original
      if (original) load(original)

      return
    }

    const context = this.#renderer.scratchPad2d
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
  }

  #applyEditValuesToRenderer(effect?: Effect, adjustments?: AdjustmentsState) {
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
    this.#rotateOriginal()

    const rotated = this.#rotated.value
    if (this.isLoading || rotated == null) throw new Error(`Source image isn't loaded.`)

    const renderer = this.#renderer
    const tempTexture = renderer.createTexture()

    const crop = this.crop.value
    let cropped = rotated

    if (crop != null) {
      const context = get2dContext()
      resizeImageSync(rotated, crop, crop, context)
      cropped = context.canvas
    }

    try {
      const size = crop ?? rotated
      renderer.setSourceTexture(tempTexture, size, size)
      renderer.loadImage(tempTexture, cropped)
      this.#applyEditValuesToRenderer(
        this.#effects.value.get(this.effect.value ?? ''),
        this.adjustments.value,
      )

      renderer.clear()
      renderer.draw()
    } finally {
      renderer.deleteTexture(tempTexture)
    }
  }

  setPreviewSourceTexture() {
    const rotated = this.#rotated.value
    if (this.isLoading || rotated == null) return
    this.#renderer.setSourceTexture(this.#texture, this.#previewSize.value, rotated, this.crop.value)
  }

  async drawPreview(context: Context2D | ImageBitmapRenderingContext = this.context) {
    const rotated = this.#rotated.value
    if (this.isLoading || rotated == null) return

    const renderer = this.#renderer
    renderer.setSourceTexture(this.#texture, this.#previewSize.value, rotated, this.crop.value)
    this.#applyEditValuesToRenderer(this.#effects.value.get(this.effect.value ?? ''), this.adjustments.value)

    renderer.clear()
    await renderer.drawAndTransfer({ context })
    if (!this.#scope.active) return

    this.onRenderPreview?.()
  }

  drawThumbnail(effect: Effect, options: Required<RendererDrawOptions>) {
    const rotated = this.#rotated.value
    if (this.isLoading || rotated == null) return

    const renderer = this.#renderer

    this.#applyEditValuesToRenderer(effect, this.adjustments.value)
    // draw thumbnails at default intensity
    renderer.setIntensity(DEFAULT_INTENSITY)

    renderer.draw(options)
  }

  dispose() {
    this.#scope.stop()
    this.#adjustColorOp = undefined as never
  }
}
