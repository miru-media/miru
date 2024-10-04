import { CROP_DRAW_DEBOUNCE_MS } from '@/constants'
import { computed, getCurrentScope, ref } from '@/framework/reactivity'
import {
  centerTo,
  cropIsEqualTo,
  devSlowDown,
  drawImage,
  fit,
  getCenter,
  offsetBy,
  setObjectSize,
} from '@/utils'
import { debounce } from 'throttle-debounce'
import Cropper from 'cropperjs'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'

export type CropContext = ReturnType<typeof useCrop>

export const useCrop = ({ engine }: { engine: ImageEditorEngine }) => {
  const { currentSource } = engine
  const cropper = ref<Cropper>()

  const aspectRatio = computed(() => {
    const crop = currentSource.value?.crop.value
    return crop ? crop.width / crop.height : NaN
  })
  const zoom = ref(1)
  const unmodifiedCrop = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotate: 0,
  }

  const scope = getCurrentScope()!
  const container = document.createElement('div')
  container.className = 'miru--cropper-container'

  scope.watch(
    [currentSource, () => currentSource.value?.original],
    async ([source, original], _prev, onCleanup) => {
      container.style.display = 'none'
      if (!source || !original) return

      let cropperImage

      const originalUrl =
        original instanceof Blob
          ? URL.createObjectURL(original)
          : original instanceof Image
            ? original.currentSrc
            : ''

      if (originalUrl) {
        cropperImage = new Image()
        cropperImage.src = originalUrl
      } else {
        cropperImage = document.createElement('canvas')
        const context = cropperImage.getContext('2d')!

        setObjectSize(cropperImage, original)
        drawImage(context, original, 0, 0)
      }

      cropperImage.setAttribute('style', 'visibility:hidden;width:100%')
      container.appendChild(cropperImage)
      container.style.display = ''

      setObjectSize(unmodifiedCrop, original)
      const cropData = source.crop.value ?? unmodifiedCrop

      if (devSlowDown) await devSlowDown()

      // https://github.com/fengyuanchen/cropperjs/blob/main/README.md
      cropper.value = new Cropper(cropperImage as never, {
        guides: true,
        center: true,
        movable: true,
        rotatable: true,
        scalable: true,
        zoomOnTouch: true,
        zoomOnWheel: true,
        dragMode: 'move',
        cropBoxMovable: false,
        cropBoxResizable: false,
        background: false,
        viewMode: 1,
        data: cropData,
        minCropBoxWidth: 1,
        minCropBoxHeight: 1,
        aspectRatio: aspectRatio.value || undefined,
        responsive: true,
        ready() {
          fitCrop()
        },
        cropend: () => recenterCropBox(),
        crop() {
          const source = currentSource.value
          const $cropper = cropper.value
          if (!source?.original || !$cropper) return

          const cropperData = $cropper.getData(true)
          source.crop.value = cropIsEqualTo(cropperData, unmodifiedCrop) ? undefined : cropperData

          const canvasData = $cropper.getCanvasData()
          zoom.value = Math.min(canvasData.width / original.width, canvasData.height / original.height)

          drawPreviewDebounced()
        },
      })

      onCleanup(() => {
        cropper.value?.destroy()
        cropper.value = undefined
        if (original instanceof Blob && originalUrl) URL.revokeObjectURL(originalUrl)
        cropperImage.remove()
      })
    },
  )

  // pause previews while cropping
  scope.watch([engine.sources], ([sources], _prev, onCleanup) => {
    sources.forEach((source) => source.pausePreview.value++)
    onCleanup(() => sources.forEach((source) => source.pausePreview.value--))
  })

  const drawPreviewDebounced = debounce(CROP_DRAW_DEBOUNCE_MS, () => {
    const source = currentSource.value
    if (source) source.forceResize.value = true
  })

  scope.watch([cropper, aspectRatio], ([cropper, aspectRatio]) => cropper?.setAspectRatio(aspectRatio))

  const setAspectRatio = (value: number) => {
    cropper.value?.setAspectRatio(value)
    recenterCropBox()
  }
  const resetCrop = () => {
    const $cropper = cropper.value
    const original = currentSource.value?.original
    if (!$cropper || !original) return

    fitCrop()
    $cropper.setAspectRatio(original.width / original.height)
    cropper.value?.setData(unmodifiedCrop)
  }
  const fitCrop = () => {
    const $cropper = cropper.value
    const original = currentSource.value?.original
    if (!$cropper || !original) return
    const container = $cropper.getContainerData()

    const data = currentSource.value?.crop.value ?? unmodifiedCrop
    const ratio = aspectRatio.value

    $cropper.zoomTo(Math.min(container.width / original.width, container.height / original.height))
    $cropper.setAspectRatio(original.width / original.height)
    $cropper.setCanvasData(fit(original, container))
    $cropper.setAspectRatio(ratio)
    $cropper.setData(data)
    recenterCropBox()
  }
  const recenterCropBox = () => {
    const $cropper = cropper.value!

    const data = currentSource.value?.crop.value ?? unmodifiedCrop

    const boxData = $cropper.getCropBoxData()
    const canvasData = $cropper.getCanvasData()
    const containerData = $cropper.getContainerData()
    const containerCenter = getCenter(containerData)

    const newBox = centerTo(boxData, containerCenter)
    $cropper.setCropBoxData(newBox)
    $cropper.setCanvasData(
      offsetBy(canvasData, { x: newBox.left - boxData.left, y: newBox.top - boxData.top }),
    )
    $cropper.setData(data)
  }

  const setZoom = (value: number) => {
    const $cropper = cropper.value
    $cropper?.zoomTo(value, getCenter($cropper.getContainerData()))
  }

  return { container, setAspectRatio, resetCrop, aspectRatio, zoom, setZoom, cropper }
}
