
import { computed, ref, toValue, watch } from '@/framework/reactivity'
import { type CropState } from '@/types'
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

import { type ImageEditor } from '../ImageEditor'
import { type ImageSourceInternal } from '../ImageSourceInternal'

export type CropContext = ReturnType<typeof useCrop>

const SIMPLE_CROP = false as boolean

export const useCrop = ({ editor, sourceIndex }: { editor: ImageEditor; sourceIndex: number }) => {
  const sourceRef = computed(
    (): ImageSourceInternal | undefined => editor.sources.value[toValue(sourceIndex)],
  )
  const cropper = ref<Cropper>()

  const aspectRatio = computed(() => {
    const crop = sourceRef.value?.crop.value

    return crop != null ? crop.width / crop.height : NaN
  })
  const zoom = ref(1)
  const unmodifiedCrop = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotate: 0,
  }

  const container = document.createElement('div')
  container.className = 'miru--cropper-container'

  watch([sourceRef, () => sourceRef.value?.original], async ([source, original], _prev, onCleanup) => {
    if (source == undefined || original == undefined) return

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

    setObjectSize(unmodifiedCrop, original)
    const cropData = source.crop.value ?? unmodifiedCrop

    if (devSlowDown != null) await devSlowDown()

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
      autoCropArea: 1,
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
  watch([editor.sources], ([sources], _prev, onCleanup) => {
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
    })
  }

  const resetCrop = async () => {
    const $cropper = cropper.value
    const source = sourceRef.value
    const original = source?.original
    if (source == undefined || $cropper == undefined || original == undefined) return

    await withUnlimitedCropper(() => {
      $cropper.setAspectRatio(original.width / original.height)
      $cropper.setData(unmodifiedCrop)
    })
    await fitCrop()
    source.crop.value = undefined
  }
  const fitCrop = twice(async () => {
    const $cropper = cropper.value
    if ($cropper == undefined) return

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
    if ($cropper == undefined) return

    const cropperOptions = ($cropper as unknown as { options: Cropper.Options }).options
    const { viewMode } = cropperOptions
    const { limited } = $cropper
    cropperOptions.viewMode = 0
    $cropper.limited = false

    await fn()

    cropperOptions.viewMode = viewMode
    $cropper.limited = limited
  }

  // use a crop-specific toggle
  const savedValue = ref<CropState>()
  const clearSavedValue = () => (savedValue.value = undefined)
  // the zoom value that should reset and compared to
  const defaultZoom = computed(() => {
    const source = sourceRef.value
    const original = source?.original
    if (source == undefined || original == undefined) return 1

    const crop = (savedValue.value = source.crop.value)
    const { width, height } = crop ?? original

    return Math.min(width / height, height / width)
  })
  const isToggledOff = computed(() => zoom.value == defaultZoom.value)
  const toggle = () => {
    const source = sourceRef.value
    const original = source?.original
    if (source == undefined || original == undefined) return

    if (savedValue.value == undefined) {
      savedValue.value = source.crop.value
      setZoom(defaultZoom.value)
    } else {
      source.crop.value = savedValue.value
    }
  }

  const toggleContext = {
    toggle,
    clearSavedValue,
    isToggledOff,
  }

  return {
    container,
    setAspectRatio,
    resetCrop: () => resetCrop().then(resetCrop),
    aspectRatio,
    zoom,
    setZoom,
    rotate,
    toggleContext,
  }
}
