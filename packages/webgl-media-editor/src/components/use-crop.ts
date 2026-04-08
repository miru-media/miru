import Cropper from 'cropperjs'
import { computed, type Ref, ref, toValue, watch } from 'fine-jsx'

import { EditorView } from 'shared/types.ts'
import { centerTo, drawImage, getCenter, setObjectSize } from 'shared/utils'

import styles from '../css/index.module.css'
import type { ImageSourceInternal } from '../image-source-internal.ts'
import type { MediaEditor } from '../media-editor.ts'

interface UseCropReturn {
  container: HTMLDivElement
  aspectRatio: Ref<number>
  zoom: Ref<number>
  tilt: Ref<'portrait' | 'landscape'>
  rotation: Ref<number>
  setAspectRatio: (value: number) => void
  setZoom: (value: number) => void
  setTilt: (value: 'portrait' | 'landscape') => void
  setRotation: (value: number) => void
  maxZoom: number
  maximizeCropBox: () => void
}

export const useCrop = ({
  editor,
  sourceIndex,
  currentView
}: {
  editor: MediaEditor
  sourceIndex: number
  currentView: Ref<EditorView>
}): UseCropReturn => {
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
  // current rotation
  const rotation = ref(0)
  // zoom. tracking handled via setZoom
  const zoom = ref(NaN)
  // tilt of the image tracker for toggling crop buttons and getting initial tilt
  const tilt = ref('portrait' as 'portrait' | 'landscape')
  // apply crop. (on -1 crop full image) apply & store crop
  const cropperPaddingFactor = 0.9
  const setAspectRatio = (ratio: number): void => {
    if (!sourceRef.value || !cropper.value) return
    const isOrig = ratio === -1
    let value = ratio
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
    maximizeCropBox()
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
    cropper.value.zoomTo(minScale * value, getCenter(cropper.value.getContainerData()))
    zoom.value = value
  }
  // apply rotation. rotate 90 deg
  const setRotation = (): void => {
    if (!cropper.value || !sourceRef.value) return
    cropper.value.rotate(90)
    // track rotation in source ref
    const cropperData = cropper.value.getData(true)
    sourceRef.value.crop.value = cropperData
    rotation.value = sourceRef.value.crop.value.rotate
  }
  // maximizeCropBox
  const maximizeCropBox = (): void => {
    if (!cropper.value || isClamping || !sourceRef.value) return
    // make sure crop box is displayed centered and as big as possible. move canvas to preserve current crop
    const containerData = cropper.value.getContainerData()
    if (containerData.width > 0 && containerData.height > 0) {
      const containerRatio = containerData.width / containerData.height
      const cropBoxRatio = cropper.value.getCropBoxData().width / cropper.value.getCropBoxData().height
      const newBox = centerTo(
        {
          width:
            cropBoxRatio > containerRatio
              ? containerData.width * cropperPaddingFactor
              : containerData.height * cropBoxRatio * cropperPaddingFactor,
          height:
            cropBoxRatio > containerRatio
              ? (containerData.width * cropperPaddingFactor) / cropBoxRatio
              : containerData.height * cropperPaddingFactor,
        },
        getCenter({ width: containerData.width, height: containerData.height }),
      )
      const oldBox = cropper.value.getCropBoxData()
      const canvasBefore = cropper.value.getCanvasData()
      isClamping = true
      cropper.value.setCropBoxData(newBox)
      const scale = newBox.width / oldBox.width
      cropper.value.setCanvasData({
        width: canvasBefore.width * scale,
        height: canvasBefore.height * scale,
        left: newBox.left + (canvasBefore.left - oldBox.left) * scale,
        top: newBox.top + (canvasBefore.top - oldBox.top) * scale,
      })
      isClamping = false
    }
  }
  // clamping flag to avoid recursive calls from cropper crop() or zoom()
  let isClamping = false
  // clamp image. make sure the image fills the crop area
  const clampImage = (): void => {
    if (!cropper.value || isClamping || !sourceRef.value) return
    // make sure crop box is displayed centered and as big as possible. move canvas to preserve current crop
    maximizeCropBox()
    // recenter cropbox. necessary bc with zoom & crop the cropbox can end up not centered
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
    const cropBoxRight = cropBoxData.left + cropBoxData.width
    const cropBoxBottom = cropBoxData.top + cropBoxData.height
    left = Math.min(cropBoxData.left, Math.max(left, cropBoxRight - width))
    top = Math.min(cropBoxData.top, Math.max(top, cropBoxBottom - height))
    // open flag, apply changes, close flag
    isClamping = true
    cropper.value.setCanvasData({ left, top, width, height })
    const cropperData = cropper.value.getData(true)
    sourceRef.value.crop.value = cropperData
    isClamping = false
  }
  // resize cropper when visible again
  watch([currentView], ()=>{
    if(!cropper.value || currentView.value !== EditorView.Crop) return
    const cropperInstance = cropper.value as unknown as Record<string, () => void>;
    setTimeout(() => {
      cropperInstance.onResize();
      maximizeCropBox()
    }, 10);
  })
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
    // create cropper
    cropper.value = await new Promise<Cropper>((resolve) => {
      const cropperInstance = new Cropper(cropperImage as never, {
        guides: true,
        center: true,
        movable: true,
        rotatable: true,
        scalable: true,
        zoomOnTouch: false,
        zoomOnWheel: false,
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
      })
    })
    // initialize cropper
    tilt.value = cropperImage.width > cropperImage.height ? 'landscape' : 'portrait'
    setZoom(1)
    setAspectRatio(-1)
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
    rotation,
    tilt,
    setAspectRatio,
    setZoom,
    setTilt,
    setRotation,
    maxZoom,
    maximizeCropBox,
  }
}
