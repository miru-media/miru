import {
  type AdjustmentsState,
  type AssetType,
  type AsyncImageSource,
  type Context2D,
  type CropState,
  type CrossOrigin,
  type DisplayContext as DisplayContext,
  type ImageEditState,
  type ImageSource,
  type ImageSourceObject,
  type ImageSourceOption,
  type SyncImageSource,
  type Tlwh,
  type Xywh,
} from '../types'
import { FULLY_SUPPORTS_OFFSCREEN_CANVAS, IS_FIREFOX, SUPPORTS_2D_OFFSCREEN_CANVAS } from '../userAgent'

import { devSlowDown } from './general'

const getCanvasContext = (
  canvas: HTMLCanvasElement | OffscreenCanvas | undefined,
  type: OffscreenRenderingContextId,
  options: unknown,
) => {
  if (canvas == undefined) {
    // try offscreen canvas
    if (FULLY_SUPPORTS_OFFSCREEN_CANVAS) {
      canvas = new OffscreenCanvas(1, 1)
      const context = canvas.getContext(type, options)

      if (context != null) return context
    }

    // try canvas element
    canvas = typeof document === 'undefined' ? undefined : document.createElement('canvas')
  }

  const context = canvas?.getContext(type, options)

  if (context == undefined) throw new Error(`[miru] Couldn't create WebGL2 context`)

  return context
}

export const getWebgl2Context = (canvas?: HTMLCanvasElement | OffscreenCanvas, options?: unknown) => {
  return getCanvasContext(canvas, 'webgl2', options) as WebGL2RenderingContext
}

export const get2dContext = (canvas?: HTMLCanvasElement | OffscreenCanvas, options?: unknown) => {
  return getCanvasContext(canvas, '2d', options) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
}

export const createDisplayContext = () => {
  const canvas = document.createElement('canvas')
  return canvas.getContext('bitmaprenderer') as DisplayContext
}

export const getImageData = (
  source: SyncImageSource,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => {
  if (source instanceof ImageData) return source

  const { canvas } = context
  const { width, height } = source

  canvas.width = width
  canvas.height = height

  context.drawImage(source, 0, 0)
  return context.getImageData(0, 0, width, height)
}

export const canvasToBlob = async (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options?: ImageEncodeOptions,
) => {
  if (isOffscreenCanvas(canvas)) return canvas.convertToBlob(options)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob != null) resolve(blob)
        else reject(new Error(`[miru] Couldn't get Blob from canvas`))
      },
      options?.type,
      options?.quality,
    )
  })
}

interface Size {
  width: number
  height: number
}

export const fit = (source: Size, container: Size, mode: 'contain' | 'cover' | 'fill' = 'contain') => {
  const sourceRatio = source.width / source.height
  const containerRatio = container.width / container.height

  let { width, height } = container

  if (mode === 'fill') {
    width = container.width
    height = container.height
  } else if (mode === 'contain' ? sourceRatio > containerRatio : sourceRatio < containerRatio) {
    height = width / sourceRatio
  } else {
    width = height * sourceRatio
  }

  width = Math.round(Math.max(width || 0, 1))
  height = Math.round(Math.max(height || 0, 1))

  const x = (container.width - width) / 2
  const y = (container.height - height) / 2

  return {
    width,
    height,
    x,
    y,
    left: x,
    top: y,
  }
}

export const fitToWidth = (source: Size, container: Size) => {
  const aspectRatio = source.width / source.height
  const width = Math.max(container.width || 0, 1)
  const height = Math.round(Math.max(width / aspectRatio || 0, 1))

  return { width, height }
}

export const setObjectSize = (object: Size, size: Size) => {
  object.width = size.width
  object.height = size.height
}

export const isOffscreenCanvas = (canvas: HTMLCanvasElement | OffscreenCanvas): canvas is OffscreenCanvas => {
  return SUPPORTS_2D_OFFSCREEN_CANVAS && canvas instanceof OffscreenCanvas
}

const isCrossOrigin = (url: string) => new URL(url, location.href).origin !== location.origin

export const decodeAsyncImageSource = <IsVideo extends boolean>(
  source: AsyncImageSource,
  crossOrigin: CrossOrigin | undefined,
  isVideo: IsVideo | undefined,
) => {
  let isClosed = false
  let toRevoke: string | undefined

  if (source instanceof Blob) {
    source = toRevoke = URL.createObjectURL(source)
  }

  const { decodePromise, media } =
    isVideo === true ? decodeVideoUrl(source, crossOrigin) : decodeImageUrl(source, crossOrigin)

  const promise = (devSlowDown != undefined ? devSlowDown(Promise.resolve(decodePromise)) : decodePromise)
    // reject if already closed
    .then((result) => (isClosed ? Promise.reject(new Error('[miru] decode source was closed')) : result))

  const close = () => {
    isClosed = true
    media.removeAttribute('src')
    media.remove()
    if ('pause' in media) media.pause()
    if (toRevoke) URL.revokeObjectURL(toRevoke)
  }

  return { promise, media: media as IsVideo extends true ? HTMLVideoElement : HTMLImageElement, close }
}

const decodeImageUrl = (url: string, crossOrigin?: CrossOrigin) => {
  const img = new Image()

  setMediaSrc(img, url, crossOrigin)
  const decodePromise = url
    ? img.decode().then(() => img)
    : Promise.reject(new Error('Empty image source URL'))
  return { decodePromise, media: img }
}

const decodeVideoUrl = (url: string, crossOrigin?: CrossOrigin) => {
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.playsInline = true
  video.setAttribute('style', 'width:1px;height:1px;position:fixed;left:-1px;top:-1px')
  document.body.appendChild(video)
  setMediaSrc(video, url, crossOrigin)
  if (url) video.load()

  const decodePromise = url
    ? new Promise<HTMLVideoElement>((resolve, reject) => {
        const onLoadedMetadata = () => {
          resolve(video)
          removeListeners()
        }
        const onAbort = () => {
          reject(new Error('aborted'))
          removeListeners()
        }
        const onError = (event: ErrorEvent) => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(video.error ?? event.error ?? new Error('Unknown video error.'))
          removeListeners()
        }

        const removeListeners = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('abort', onAbort)
          video.removeEventListener('abort', onAbort)
        }

        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
        video.addEventListener('abort', onAbort, { once: true })
        video.addEventListener('error', onError, { once: true })
      })
    : Promise.reject(new Error('Empty video source URL'))

  return { decodePromise, media: video }
}

const setMediaSrc = (media: HTMLImageElement | HTMLMediaElement, url: string, crossOrigin?: CrossOrigin) => {
  // set crossOrigin value if provided
  if (crossOrigin !== undefined) media.crossOrigin = crossOrigin
  // otherwise set anonymous if needed
  else if (isCrossOrigin(url)) media.crossOrigin = 'anonymous'

  media.src = url
}

export const resizeImageSync = (
  source: SyncImageSource,
  crop: CropState | undefined,
  size: Size,
  context: Context2D,
) => {
  const { canvas } = context
  setObjectSize(canvas, size)

  if ('data' in source) {
    context.save()
    context.scale(size.width / source.width, size.height / source.height)
    if (crop != undefined) context.putImageData(source, 0, 0, crop.x, crop.y, crop.width, crop.height)
    else context.putImageData(source, 0, 0)
    context.restore()
  } else {
    if (crop != undefined)
      context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height)
    else context.drawImage(source, 0, 0, source.width, source.height, 0, 0, size.width, size.height)
  }
}

export const resizeImage = async (
  source: SyncImageSource,
  crop: CropState | undefined,
  size: Size,
  context: Context2D,
) => {
  const resizeOptions = {
    resizeWidth: size.width,
    resizeHeight: size.height,
    resizeQuality: 'high',
  } as const

  if (crop == undefined) return createImageBitmap(source, resizeOptions)

  // using createImageBitmap with `sx, sy, sw, sh` options in firefox 130 doesn't work correctly
  if (IS_FIREFOX) {
    const { canvas } = context
    setObjectSize(canvas, size)

    if ('data' in source) {
      context.save()
      context.scale(size.width / source.width, size.height / source.height)
      context.putImageData(source, 0, 0, crop.x, crop.y, crop.width, crop.height)
      context.restore()
    } else context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height)

    return createImageBitmap(canvas)
  } else {
    return createImageBitmap(source, crop.x, crop.y, crop.width, crop.height, resizeOptions)
  }
}

export const drawImage = (context: Context2D, image: SyncImageSource, dx: number, dy: number) => {
  if ('data' in image) context.putImageData(image, dx, dy)
  else context.drawImage(image, dx, dy)
}

export const isSyncSource = (source: ImageSource): source is SyncImageSource => {
  return !(typeof source === 'string' || source instanceof Blob)
}

export const isObjectWithSource = (source: ImageSourceOption): source is ImageSourceObject => {
  return typeof source !== 'string' && 'source' in source && Boolean(source.source)
}

export const normalizeSourceOption = <T extends ImageSource>(
  source: T | ImageSourceObject,
  type?: AssetType,
) =>
  (isObjectWithSource(source) ? source : { source: source, type }) as T extends ImageSource
    ? { source: T } & ImageSourceObject
    : ImageSourceObject

export const editIsEqualTo = (a: ImageEditState | undefined, b: ImageEditState | undefined) => {
  if (a === b) return true

  if (!a || !b) return false

  if (a.effect !== b.effect || a.intensity !== b.intensity) return false

  if (!cropIsEqualTo(a.crop, b.crop)) return false
  if (!adjustmentIsEqualTo(a.adjustments, b.adjustments)) return false

  return true
}

export const adjustmentIsEqualTo = (a: AdjustmentsState | undefined, b: AdjustmentsState | undefined) => {
  if (a === b) return true

  if (!a || !b) return false

  return a.brightness === b.brightness && a.contrast === b.contrast && a.saturation === b.saturation
}

export const cropIsEqualTo = (a: CropState | undefined, b: CropState | undefined) => {
  if (a === b) return true

  if (!a || !b) return false

  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.rotate === b.rotate
}

export const getCenter = (rect: Partial<Xywh & Tlwh> & Size) => ({
  x: (rect.x ?? rect.left ?? 0) + rect.width / 2,
  y: (rect.y ?? rect.top ?? 0) + rect.height / 2,
})

export const offsetBy = (rect: Partial<Xywh & Tlwh> & Size, delta: { x: number; y: number }) => {
  const x = (rect.x ?? rect.left ?? 0) + delta.x
  const y = (rect.y ?? rect.top ?? 0) + delta.y

  return {
    x,
    y,
    left: x,
    top: y,
    width: rect.width,
    height: rect.height,
  }
}

export const centerTo = (rect: Partial<Xywh & Tlwh> & Size, newCenter: { x: number; y: number }) => {
  const center = getCenter(rect)

  return offsetBy(rect, { x: newCenter.x - center.x, y: newCenter.y - center.y })
}
