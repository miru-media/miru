import Cropper from 'cropperjs'
import { computed, type Ref, ref, toValue, watch } from 'fine-jsx'

import { centerTo, drawImage, getCenter, setObjectSize } from 'shared/utils'

import styles from '../css/index.module.css'
import type { ImageSourceInternal } from '../image-source-internal.ts'
import type { MediaEditor } from '../media-editor.ts'

interface UseCroptReturn {
  container: HTMLDivElement
  aspectRatio: Ref<number>
  aspectRatioUnchanged: Ref<boolean>
  zoom: Ref<number>
  setAspectRatio: (value: number, tilt: 'portrait' | 'landscape') => void
  setZoom: (value: number) => void
  setRotation: (value: number) => void
}

export const useCropt = ({
  editor,
  sourceIndex,
}: {
  editor: MediaEditor
  sourceIndex: number
}): UseCroptReturn => {
  // cropper instance
  const cropper = ref<Cropper>()
  // image source
  const sourceRef = computed(
    (): ImageSourceInternal | undefined => editor.sources.value[toValue(sourceIndex)],
  )
  // dom element hosting the cropper & <img>
  const container = document.createElement('div')
  container.className = styles['miru--cropper-container']
  // current aspect ratio
  const aspectRatio = computed(() => {
    const crop = sourceRef.value?.crop.value
    if (!crop) return NaN
    return crop.width / crop.height
  })
  // current crop is original aspect ratio
  const aspectRatioUnchanged = ref(true)
  // zoom. tracking handled via setZoom
  const zoom = ref(NaN)
  // apply crop. (on -1 crop full image) apply & store crop
  const setAspectRatio = (value: number, tilt: 'portrait' | 'landscape'): void => {
    if (!sourceRef.value || !cropper.value) return
    // flip ratio if necessary for tilt
    value = (value < 1 && tilt === 'landscape') || (value > 1 && tilt === 'portrait') ? 1 / value : value
    // set aspect ratio
    if (value === -1) {
      const { naturalWidth, naturalHeight } = cropper.value.getImageData()
      value = naturalWidth / naturalHeight
    }
    cropper.value.setAspectRatio(value)
    // track crop in source ref
    const cropperData = cropper.value.getData(true)
    sourceRef.value.crop.value = cropperData
    // recenter cropbox. necessary bc with zoom & crop the cropbox can end up not centered
    const {width, height} = cropper.value.getContainerData()
    const containerRatio = width / height
    const newBox = centerTo(
      {
        width: value > containerRatio ? width : height * value,
        height: value > containerRatio ? width / value : height,
      },
      getCenter({width, height}),
    )
    cropper.value.setCropBoxData(newBox)
    // make sure image fits. minimize image to force resize on clamp
    const zoomForSnapping = 1
    setZoom(zoomForSnapping)
    clampImage()
    // track unchanged status
    aspectRatioUnchanged.value = value === -1
  }
  // apply zoom. get pivot point & apply and store zoom
  const setZoom = (value: number): void => {
    if (!cropper.value) return
    // get scale factire
    const canvasData = cropper.value.getCanvasData()
    const cropBoxData = cropper.value.getCropBoxData()
    const baseScale = Math.max(
      cropBoxData.width / canvasData.naturalWidth,
      cropBoxData.height / canvasData.naturalHeight,
    )
    cropper.value.zoomTo(baseScale * value)
    zoom.value = value

    // const { width, height, naturalWidth, naturalHeight } = cropper.value.getCanvasData()
    // zoom.value = Math.min(width / naturalWidth, height / naturalHeight)
    // cropper.value.zoomTo(baseScale * value)
  }
  // apply rotation. rotate 90 deg
  const setRotation = (): void => {
    if (!cropper.value || !sourceRef.value) return
    cropper.value.rotate(90)
    // track rotation in source ref
    const cropperData = cropper.value.getData(true)
    sourceRef.value.crop.value = cropperData
  }
  // clamping flag to avoid recursive calls from cropper crop() or zoom()
  let isClamping = false
  // clamp image. make sure the image fills the crop area
  const clampImage = (): void => {
    if (!cropper.value || isClamping) return
    const canvasData = cropper.value.getCanvasData()
    const cropBoxData = cropper.value.getCropBoxData()
    // grab canvas data to modify
    let { left, top, width, height } = canvasData
    // ensure canvas scale can fill the crop box
    if (width < cropBoxData.width || height < cropBoxData.height) {
      const scale = Math.max(cropBoxData.width / width, cropBoxData.height / height)
      width *= scale
      height *= scale
      // track zoom // @todo improve zoom tracking
      const baseScale = Math.max(
        cropBoxData.width / canvasData.naturalWidth,
        cropBoxData.height / canvasData.naturalHeight,
      )
      zoom.value = scale / baseScale
    }
    // ensure position sticks to the edges of the crop box
    left = Math.min(cropBoxData.left, Math.max(left, cropBoxData.left + cropBoxData.width - width))
    top = Math.min(cropBoxData.top, Math.max(top, cropBoxData.top + cropBoxData.height - height))
    // open flag, apply changes, close flag
    isClamping = true
    cropper.value.setCanvasData({ left, top, width, height })
    isClamping = false
  }
  // create new cropper on source change
  watch([sourceRef, () => sourceRef.value?.original], async ([source, original], _prev, onCleanup) => {
    if (source == null || original == null) return
    // create canvas element & append to container

    // create canvas element & append to container
    const cropperImage = document.createElement('canvas')
    setObjectSize(cropperImage, original)
    const context = cropperImage.getContext('2d')
    if (!context) return
    drawImage(context, original, 0, 0)
    cropperImage.setAttribute('style', 'visibility:hidden;width:100%')
    container.appendChild(cropperImage)
    // create cropper
    cropper.value = await new Promise<Cropper>((resolve) => {
      const cropperInstance = new Cropper(cropperImage, {
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
        viewMode: 0,
        data: source.crop.value ?? {},
        minCropBoxWidth: 1,
        minCropBoxHeight: 1,
        aspectRatio: aspectRatio.value,
        autoCrop: true,
        autoCropArea: 1,
        responsive: true,
        ready() {
          resolve(cropperInstance)
        },
        crop() {
          clampImage()
        },
        zoom() {
          clampImage()
        },
      })
    })
    // initialize cropper
    setZoom(1)
    // remove cropper on unwatch
    onCleanup(() => {
      cropper.value?.destroy()
      cropper.value = undefined
      cropperImage.remove()
    })
  })
  // returns
  return {
    container,
    aspectRatio,
    aspectRatioUnchanged,
    zoom,
    setAspectRatio,
    setZoom,
    setRotation,
  }
}
