import { FULLY_SUPPORTS_OFFSCREEN_CANVAS, IS_FIREFOX, SUPPORTS_2D_OFFSCREEN_CANVAS } from '../constants'
import {
  AdjustmentsState,
  AsyncImageSource,
  Context2D,
  CropState,
  CrossOrigin,
  DisplayContext as DisplayContext,
  ImageEditState,
  ImageSource,
  ImageSourceObject,
  ImageSourceOption,
  SyncImageSource,
  Tlwh,
  Xywh,
} from '../types'
import { devSlowDown } from './general'

const getCanvasContext = (
  canvas: HTMLCanvasElement | OffscreenCanvas | undefined,
  type: OffscreenRenderingContextId,
  options: unknown,
) => {
  if (!canvas) {
    // try offscreen canvas
    if (FULLY_SUPPORTS_OFFSCREEN_CANVAS) {
      canvas = new OffscreenCanvas(1, 1)
      const context = canvas.getContext(type, options)

      if (context) return context
    }

    // try canvas element
    canvas = typeof document === 'undefined' ? undefined : document.createElement('canvas')
  }

  const context = canvas?.getContext(type, options)

  if (!context) throw new Error(`[miru] Couldn't create WebGL2 context`)

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
        if (blob) resolve(blob)
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

export const decodeAsyncImageSource = (source: AsyncImageSource, crossOrigin?: CrossOrigin) => {
  let isClosed = false
  let toRevoke: string | undefined

  if (source instanceof Blob) {
    source = toRevoke = URL.createObjectURL(source)
  }

  const img = new Image()

  // set crossOrigin value if provided
  if (crossOrigin !== undefined) img.crossOrigin = crossOrigin
  // otherwise set anonymous if needed
  else if (isCrossOrigin(source)) img.crossOrigin = 'anonymous'

  img.src = source
  const decodePromise = img.decode().then(() => img)

  const promise = (devSlowDown ? devSlowDown(decodePromise) : decodePromise)
    // reject if already closed
    .then((result) => (isClosed ? Promise.reject(new Error('[miry] decode source was closed')) : result))

  const close = () => {
    isClosed = true
    img.src = ''
    if (toRevoke) URL.revokeObjectURL(toRevoke)
  }

  return { promise, close }
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
    if (crop) context.putImageData(source, 0, 0, crop.x, crop.y, crop.width, crop.height)
    else context.putImageData(source, 0, 0)
    context.restore()
  } else {
    if (crop)
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

  if (!crop) return createImageBitmap(source, resizeOptions)

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

export class Janitor {
  private _onDispose = new Set<() => void>()
  isDisposed = false

  add(fn: () => void) {
    this._onDispose.add(fn)
  }

  dispose() {
    this._onDispose.forEach((fn) => fn())
    this._onDispose.clear()
    this.isDisposed = true
  }
}

export const isSyncSource = (source: ImageSource): source is SyncImageSource => {
  return !(typeof source === 'string' || source instanceof Blob)
}

export const isObjectWithSource = (source: ImageSourceOption): source is ImageSourceObject => {
  return typeof source !== 'string' && 'source' in source && !!source.source
}

export const normalizeSourceOption = <T extends ImageSourceObject>(
  source: ImageSource | T,
  isLut?: boolean,
) =>
  isObjectWithSource(source) ? source : ({ source: source, isLut } as { source: ImageSource } & Partial<T>)

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
