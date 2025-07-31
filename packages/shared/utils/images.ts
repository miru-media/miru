import type { AssetType, Context2D, CropState } from 'webgl-effects'

import type {
  AdjustmentsState,
  AsyncImageSource,
  CrossOrigin,
  ImageEditState,
  ImageSource,
  ImageSourceObject,
  ImageSourceOption,
  SyncImageSource,
  Tlwh,
  Xywh,
} from '../types.ts'
import { FULLY_SUPPORTS_OFFSCREEN_CANVAS, IS_FIREFOX, SUPPORTS_2D_OFFSCREEN_CANVAS } from '../userAgent.ts'
import { getImageSize } from '../video/utils.ts'

const getCanvasContext = (
  canvas: HTMLCanvasElement | OffscreenCanvas | undefined,
  type: OffscreenRenderingContextId,
  options: unknown,
) => {
  if (canvas == null) {
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

  if (!context) throw new Error(`[miru] Couldn't create ${type} context`)

  return context
}

export const getWebgl2Context = (canvas?: HTMLCanvasElement | OffscreenCanvas, options?: unknown) =>
  getCanvasContext(canvas, 'webgl2', options) as WebGL2RenderingContext

export const get2dContext = <T extends HTMLCanvasElement | OffscreenCanvas>(canvas?: T, options?: unknown) =>
  getCanvasContext(canvas, '2d', options) as T extends HTMLCanvasElement
    ? CanvasRenderingContext2D
    : OffscreenCanvasRenderingContext2D

export const createDisplayContext = () => get2dContext(document.createElement('canvas'))

export const getImageData = (
  source: SyncImageSource,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => {
  if (source instanceof ImageData) return source

  const { canvas } = context
  const { width, height } = getImageSize(source)

  canvas.width = width
  canvas.height = height

  context.drawImage(source, 0, 0)
  return context.getImageData(0, 0, width, height)
}

export const canvasToBlob = async (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options?: ImageEncodeOptions,
) => {
  if (isOffscreenCanvas(canvas)) return await canvas.convertToBlob(options)

  return await new Promise<Blob>((resolve, reject) => {
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
    ;({ width, height } = container)
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

export const isOffscreenCanvas = (canvas: HTMLCanvasElement | OffscreenCanvas): canvas is OffscreenCanvas =>
  SUPPORTS_2D_OFFSCREEN_CANVAS && canvas instanceof OffscreenCanvas

const isCrossOrigin = (url: string) => new URL(url, location.href).origin !== location.origin

export const loadAsyncImageSource = <IsVideo extends boolean>(
  source: AsyncImageSource,
  crossOrigin: CrossOrigin | undefined,
  isVideo: IsVideo | undefined,
) => {
  let isClosed = false
  let toRevoke: string | undefined
  let media: HTMLVideoElement | ImageBitmap | undefined

  const loadPromise =
    isVideo === true
      ? loadVideoUrl(
          source instanceof Blob ? (source = toRevoke = URL.createObjectURL(source)) : source,
          crossOrigin,
        )
      : loadImageUrlOrBlob(source, crossOrigin)

  const promise = loadPromise
    // reject if already closed
    .then((result) => {
      media = result

      if (isClosed) {
        closeMedia()
        throw new Error('[miru] decode source was closed')
      }

      return result
    }) as Promise<IsVideo extends true ? HTMLVideoElement : ImageBitmap>

  const closeMedia = () => {
    if (!media) return

    if (media instanceof HTMLElement) {
      media.removeAttribute('src')
      media.load()
      media.remove()
      media.pause()
    } else media.close()

    media = undefined
  }

  const close = () => {
    isClosed = true
    closeMedia()

    if (toRevoke) URL.revokeObjectURL(toRevoke)
  }

  return { promise, close }
}

const loadImageUrlOrBlob = async (source: string | Blob, crossOrigin?: CrossOrigin) => {
  const blob =
    typeof source === 'string'
      ? // fetch url source as blob
        await fetch(source, { credentials: crossOrigin === 'use-credentials' ? 'include' : 'omit' }).then(
          (res) => res.blob(),
        )
      : // use blob source
        source

  return await createImageBitmap(blob)
}

export const createHiddenMediaElement = <T extends 'audio' | 'video'>(
  type: T,
  url: string,
  crossOrigin?: CrossOrigin,
) => {
  const media = document.createElement(type) as T extends 'audio' ? HTMLAudioElement : HTMLVideoElement

  if (type === 'video') (media as HTMLVideoElement).playsInline = true
  media.preload = 'auto'
  media.muted = true
  media.setAttribute('style', 'width:1px;height:1px;position:fixed;left:-1px;top:-1px')
  document.body.appendChild(media)
  setMediaSrc(media, url, crossOrigin)
  media.load()

  return media
}

const loadVideoUrl = (url: string, crossOrigin?: CrossOrigin) => {
  if (!url) throw new Error('Empty video source URL')
  const video = createHiddenMediaElement('video', url, crossOrigin)

  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const onLoadedMetadata = () => {
      resolve(video)
      removeListeners()
    }
    const onAbort = () => {
      reject(new Error('aborted'))
      removeListeners()
    }
    const onError = (event: ErrorEvent) => {
      reject((video.error ?? event.error ?? new Error('Unknown video error.')) as Error)
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
    if (crop != null) context.putImageData(source, 0, 0, crop.x, crop.y, crop.width, crop.height)
    else context.putImageData(source, 0, 0)
    context.restore()
  } else {
    if (crop != null)
      context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height)
    else {
      const { width, height } = getImageSize(source)
      context.drawImage(source, 0, 0, width, height, 0, 0, size.width, size.height)
    }
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

  if (crop == null) return await createImageBitmap(source, resizeOptions)

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

    return await createImageBitmap(canvas)
  } else {
    return await createImageBitmap(source, crop.x, crop.y, crop.width, crop.height, resizeOptions)
  }
}

export const drawImage = (context: Context2D, image: SyncImageSource, dx: number, dy: number) => {
  if ('data' in image) context.putImageData(image, dx, dy)
  else context.drawImage(image, dx, dy)
}

export const isSyncSource = (source: ImageSource): source is SyncImageSource =>
  !(typeof source === 'string' || source instanceof Blob)

export const isObjectWithSource = (source: ImageSourceOption): source is ImageSourceObject =>
  typeof source !== 'string' && 'source' in source && Boolean(source.source)

export const normalizeSourceOption = <T extends ImageSource>(
  source: T | ImageSourceObject,
  type?: AssetType,
) =>
  (isObjectWithSource(source) ? source : { source, type }) as T extends ImageSource
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
