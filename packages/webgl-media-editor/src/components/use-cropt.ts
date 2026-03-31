import Cropper from 'cropperjs'
import { computed, type Ref, ref, toValue, watch } from 'fine-jsx'

import { centerTo, drawImage, getCenter, setObjectSize } from 'shared/utils'

import styles from '../css/index.module.css'
import type { ImageSourceInternal } from '../image-source-internal.ts'
import type { MediaEditor } from '../media-editor.ts'

interface UseCroptReturn {
  container: HTMLDivElement
  aspectRatio: Ref<number>
  zoom: Ref<number>
  tilt: Ref<'portrait' | 'landscape'>
  setAspectRatio: (value: number) => void
  setZoom: (value: number) => void
  setTilt: (value: 'portrait' | 'landscape') => void
  setRotation: (value: number) => void
  maxZoom: number
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
  // maximum zoom allowed. used for gesture zoom limit
  const maxZoom = 2
  // image source
  const sourceRef = computed(
    (): ImageSourceInternal | undefined => editor.sources.value[toValue(sourceIndex)],
  )
  // dom element hosting the cropper & <img>
  const container = document.createElement('div')
  container.className = styles['miru--cropper-container']
  // current aspect ratio
  const aspectRatio = ref(-1)
  // zoom. tracking handled via setZoom
  const zoom = ref(NaN)
  // tilt of the image tracker for toggling crop buttons and getting initial tilt
  const tilt = ref('portrait' as 'portrait' | 'landscape')
  // apply crop. (on -1 crop full image) apply & store crop
  const cropperPaddingFactor = 0.9
  const setAspectRatio = (value: number): void => {
    if (!sourceRef.value || !cropper.value) return
    const isOrig = value === -1
    // set original aspect ratio if wanted
    if (isOrig) {
      const { naturalWidth, naturalHeight } = cropper.value.getImageData()
      value = tilt.value === 'landscape' ? naturalWidth / naturalHeight : naturalHeight / naturalWidth
    }
    // flip ratio if necessary for tilt
    value =
      (value < 1 && tilt.value === 'landscape') || (value > 1 && tilt.value === 'portrait')
        ? 1 / value
        : value

    cropper.value.setAspectRatio(value)
    // track crop in source ref
    const cropperData = cropper.value.getData(true)
    sourceRef.value.crop.value = cropperData
    // recenter cropbox. necessary bc with zoom & crop the cropbox can end up not centered
    const { width, height } = cropper.value.getContainerData()

    const containerRatio = width / height
    const newBox = centerTo(
      {
        width: value > containerRatio ? width * cropperPaddingFactor : height * value * cropperPaddingFactor,
        height:
          value > containerRatio ? (width * cropperPaddingFactor) / value : height * cropperPaddingFactor,
      },
      getCenter({ width, height }),
    )
    cropper.value.setCropBoxData(newBox)
    // make sure image fits. minimize image to force resize on clamp
    const zoomForSnapping = 1
    setZoom(zoomForSnapping)
    clampImage()
    // track unchanged status
    aspectRatio.value = isOrig ? -1 : value
  }
  // set tilt > turns cropper sideways
  const setTilt = (value: 'landscape' | 'portrait'): void => {
    tilt.value = value
    const crop = sourceRef.value?.crop.value
    if (!crop) return
    setAspectRatio(aspectRatio.value)
  }
  // apply zoom. get pivot point & apply and store zoom
  const setZoom = (value: number): void => {
    if (!cropper.value) return
    // get scale factire
    const canvasData = cropper.value.getCanvasData()
    const cropBoxData = cropper.value.getCropBoxData()
    const minScale = Math.max(
      cropBoxData.width / canvasData.naturalWidth,
      cropBoxData.height / canvasData.naturalHeight,
    )
    cropper.value.zoomTo(minScale * value)
    zoom.value = value
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
    if (!cropper.value || isClamping || !sourceRef.value) return
    const canvasData = cropper.value.getCanvasData()
    const cropBoxData = cropper.value.getCropBoxData()
    // grab canvas data to modify
    let { left, top, width, height } = canvasData
    // minimum scale to fill the crop box in the current orientation. minimum is always 1
    const minScale = Math.max(
      tilt.value === 'portrait'
        ? cropBoxData.height / canvasData.naturalHeight
        : cropBoxData.width / canvasData.naturalWidth,
      tilt.value === 'portrait'
        ? cropBoxData.width / canvasData.naturalWidth
        : cropBoxData.height / canvasData.naturalHeight,
    )
    // ensure canvas scale can fill the crop box
    if (width < cropBoxData.width || height < cropBoxData.height) {
      const scale = Math.max(cropBoxData.width / width, cropBoxData.height / height)
      width *= scale
      height *= scale
    }
    // ensure max scroll is the limit
    else if (width / (canvasData.naturalWidth * minScale) > maxZoom) {
      const scale = (canvasData.naturalWidth * minScale * maxZoom) / width
      width *= scale
      height *= scale
    }
    // store new zoom
    zoom.value = width / (canvasData.naturalWidth * minScale)
    // ensure position sticks to the edges of the crop box
    left = Math.min(cropBoxData.left, Math.max(left, cropBoxData.left + cropBoxData.width - width))
    top = Math.min(cropBoxData.top, Math.max(top, cropBoxData.top + cropBoxData.height - height))
    // open flag, apply changes, close flag
    isClamping = true
    cropper.value.setCanvasData({ left, top, width, height })
    const cropperData = cropper.value.getData(true)
    sourceRef.value.crop.value = cropperData
    isClamping = false
  }
  // create new cropper on source change
  watch([sourceRef, () => sourceRef.value?.original], async ([source, original], _prev, onCleanup) => {
    if (source == null || original == null) return
    // create canvas element from one of the allowed types
    let cropperImage: HTMLImageElement | HTMLCanvasElement
    const originalUrl =
      original instanceof Blob
        ? URL.createObjectURL(original)
        : original instanceof Image
          ? original.currentSrc
          : '' // < triggers else
    if (originalUrl) {
      cropperImage = new Image()
      cropperImage.src = originalUrl
    } else {
      cropperImage = document.createElement('canvas')
      const context = cropperImage.getContext('2d')
      if (!context) return
      setObjectSize(cropperImage, original)
      drawImage(context, original, 0, 0)
    }
    // append to container
    cropperImage.setAttribute('style', 'visibility:hidden;width:100%')
    container.appendChild(cropperImage)
    // // create canvas element & append to container
    // const cropperImage = document.createElement('canvas')
    // setObjectSize(cropperImage, original)
    // const context = cropperImage.getContext('2d')
    // if (!context) return
    // drawImage(context, original, 0, 0)
    // cropperImage.setAttribute('style', 'visibility:hidden;width:100%')
    // container.appendChild(cropperImage)
    // create cropper
    cropper.value = await new Promise<Cropper>((resolve) => {
      const cropperInstance = new Cropper(cropperImage as never, {
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
    tilt.value = cropperImage.width > cropperImage.height ? 'landscape' : 'portrait'
    // const cropperData = sourceRef.value?.crop.value
    setZoom(1)
    setAspectRatio(-1)

    // if (cropperData) {
    //   setAspectRatio(cropperData.width / cropperData.height)
    // } else {
    //   tilt.value = 'landscape'
    //   setZoom(1)
    // }
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
    zoom,
    tilt,
    setAspectRatio,
    setZoom,
    setTilt,
    setRotation,
    maxZoom,
  }
}
