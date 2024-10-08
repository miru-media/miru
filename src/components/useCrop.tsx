import { computed, getCurrentScope, ref, toValue } from '@/framework/reactivity'
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
import Cropper from 'cropperjs'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { ImageSourceState } from '@/engine/ImageSourceState'

export type CropContext = ReturnType<typeof useCrop>

const SIMPLE_CROP = false

export const useCrop = ({ engine, sourceIndex }: { engine: ImageEditorEngine; sourceIndex: number }) => {
  const source = computed((): ImageSourceState | undefined => engine.sources.value[toValue(sourceIndex)])
  const cropper = ref<Cropper>()

  const aspectRatio = computed(() => {
    const crop = source.value?.crop.value

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

  scope.watch([source, () => source.value?.original], async ([source, original], _prev, onCleanup) => {
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
    const $cropper = (cropper.value = new Cropper(cropperImage as never, {
      guides: true,
      center: true,
      movable: true,
      rotatable: true,
      scalable: true,
      zoomOnTouch: true,
      zoomOnWheel: true,
      dragMode: SIMPLE_CROP ? 'crop' : 'move',
      cropBoxMovable: SIMPLE_CROP,
      cropBoxResizable: false,
      background: false,
      viewMode: 1,
      data: cropData,
      minCropBoxWidth: 1,
      minCropBoxHeight: 1,
      aspectRatio: aspectRatio.value,
      autoCropArea: 0.9,
      responsive: true,
      async ready() {
        await fitCrop()
        await setAspectRatio(aspectRatio.value)
      },
      cropend() {
        if (!SIMPLE_CROP) recenterCropBox().catch(() => undefined)
      },
      crop() {
        const { width, height, naturalWidth, naturalHeight } = $cropper.getCanvasData()
        zoom.value = Math.min(width / naturalWidth, height / naturalHeight)
        const cropperData = $cropper.getData(true)
        source.crop.value = cropIsEqualTo(cropperData, unmodifiedCrop) ? undefined : cropperData
      },
    }))

    onCleanup(() => {
      cropper.value?.destroy()
      cropper.value = undefined
      if (original instanceof Blob && originalUrl) URL.revokeObjectURL(originalUrl)
      cropperImage.remove()
    })
  })

  // pause previews while cropping
  scope.watch([engine.sources], ([sources], _prev, onCleanup) => {
    sources.forEach((source) => source.pausePreview.value++)
    onCleanup(() => sources.forEach((source) => source.pausePreview.value--))
  })

  const twice = (fn: () => unknown) => async () => {
    await fn()
    await fn()
  }

  const setAspectRatio = async (value: number) => {
    await withUnlimitedCropper(async () => {
      await fitCrop()
      cropper.value?.setAspectRatio(value)
      // await recenterCropBox()
    })
  }

  const resetCrop = async () => {
    const $cropper = cropper.value
    const $source = source.value
    const original = $source?.original
    if (!$cropper || !original) return

    await withUnlimitedCropper(() => {
      $cropper.setAspectRatio(original.width / original.height)
      $cropper.setData(unmodifiedCrop)
    })
    await fitCrop()
    $source.crop.value = undefined
  }
  const fitCrop = twice(async () => {
    const $cropper = cropper.value
    if (!$cropper) return

    const container = $cropper.getContainerData()
    const { naturalWidth, naturalHeight } = $cropper.getCanvasData()

    await withUnlimitedCropper(async () => {
      $cropper.zoomTo(Math.min(container.width / naturalWidth, container.height / naturalHeight))
      $cropper.setCanvasData(fit({ width: naturalWidth, height: naturalHeight }, container))
      await Promise.resolve()
    })
    if (!SIMPLE_CROP) await recenterCropBox()
  })

  const recenterCropBox = async () => {
    const $cropper = cropper.value!
    const data = $cropper.getData()

    const boxData = $cropper.getCropBoxData()
    const canvasData = $cropper.getCanvasData()
    const containerData = $cropper.getContainerData()
    const containerCenter = getCenter(containerData)

    const newBox = centerTo(boxData, containerCenter)

    await withUnlimitedCropper(() => {
      // debugger
      $cropper.setCropBoxData(newBox)
      $cropper.setCanvasData(
        offsetBy(canvasData, { x: newBox.left - boxData.left, y: newBox.top - boxData.top }),
      )
      $cropper.setData(data)
    })
  }

  const setZoom = (value: number) => {
    const $cropper = cropper.value
    $cropper?.zoomTo(value, getCenter($cropper.getContainerData()))
  }

  const rotate = async () => {
    await withUnlimitedCropper(async () => {
      cropper.value?.rotate(90)
      if (SIMPLE_CROP) return

      await setAspectRatio(aspectRatio.value)
    })
  }

  const withUnlimitedCropper = async (fn: () => unknown) => {
    const $cropper = cropper.value as any
    if (!$cropper) return

    const cropperOptions = ($cropper as unknown as { options: Cropper.Options }).options
    const { viewMode } = cropperOptions
    const { limited } = $cropper
    cropperOptions.viewMode = 0
    $cropper.limited = false

    await fn()

    cropperOptions.viewMode = viewMode
    $cropper.limited = limited
  }

  return {
    container,
    setAspectRatio,
    resetCrop: () => resetCrop().then(resetCrop),
    aspectRatio,
    zoom,
    setZoom,
    rotate,
  }
}
