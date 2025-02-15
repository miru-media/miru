import { computed, effect, type MaybeRefOrGetter, onScopeDispose, ref, toValue, watch } from 'fine-jsx'

import { MP4Demuxer } from 'shared/transcode/demuxer'
import { type Size } from 'shared/types'
import { loadAsyncImageSource, promiseWithResolvers, useEventListener } from 'shared/utils'

export const useMappedUniqueArray = <T extends object, U>(
  sourceArrayRef: MaybeRefOrGetter<T[]>,
  toMapValue: (arrayItem: T) => U,
  disposeMapValue?: (mapValue: U) => unknown,
) => {
  const weakMap = new WeakMap<T, U>()
  let prevMappedArray: U[] = []

  const mappedArrayRef = computed(() => {
    const array = toValue(sourceArrayRef)
    const newMappedArray: U[] = []

    array.forEach((arrayItem) => {
      const mapValue = weakMap.get(arrayItem) ?? toMapValue(arrayItem)
      weakMap.set(arrayItem, mapValue)
      newMappedArray.push(mapValue)
    })

    if (disposeMapValue) {
      const newSet = new Set(newMappedArray)
      prevMappedArray.forEach((value) => {
        if (!newSet.has(value)) disposeMapValue(value)
      })

      prevMappedArray = newMappedArray
    }

    return newMappedArray
  })

  onScopeDispose(() => {
    const mapped = mappedArrayRef.value
    if (disposeMapValue) mapped.forEach((value) => disposeMapValue(value))
    mapped.length = 0
  })

  return mappedArrayRef
}

export const useMediaReadyState = (media: MaybeRefOrGetter<HTMLMediaElement | undefined>) => {
  const readyState = ref(0)
  const updateValue = () => (readyState.value = toValue(media)?.readyState ?? 0)
  const events = [
    'abort',
    'canplay',
    'canplaythrough',
    'durationchange',
    'emptied',
    'ended',
    'error',
    'loadeddata',
    'loadedmetadata',
    'loadstart',
    'pause',
    'play',
    'playing',
    'seeked',
    'seeking',
    'stalled',
    'suspend',
    'timeupdate',
    'waiting',
  ]

  effect(updateValue)
  events.forEach((type) => useEventListener(media, type, updateValue))

  return readyState
}

export const useMediaError = (media: MaybeRefOrGetter<HTMLMediaElement | undefined>) => {
  const error = ref<MediaError>()
  const updateValue = () => (error.value = toValue(media)?.error ?? undefined)
  const events = ['error', 'loadedmetadata', 'canplay']

  effect(updateValue)
  events.forEach((type) => useEventListener(media, type, updateValue))

  return error
}

export const splitTime = (timeS: number) => {
  const minutes = String(Math.trunc(timeS / 60) % 60).padStart(2, '0')
  const hoursNumber = Math.trunc(timeS / (60 * 60))
  const hours = String(hoursNumber).padStart(2, '0')
  const seconds = String(Math.trunc(timeS) % 60).padStart(2, '0')
  const subSeconds = String(Math.trunc((timeS % 1) * 100)).padStart(2, '0')

  return { minutes, hours, seconds, subSeconds }
}

export const formatTime = (timeS: number, withSubSeconds = true) => {
  const { minutes, hours, seconds, subSeconds } = splitTime(timeS)

  return `${hours === '00' ? '' : `${hours}:`}${minutes}:${seconds}${withSubSeconds ? `.${subSeconds}` : ''}`
}

const { DurationFormat } = Intl as unknown as {
  DurationFormat?: new (...args: unknown[]) => { format(...args: unknown[]): string }
}

export const formatDuration = (durationS: number, languages = navigator.languages) => {
  const secondsFormat = new Intl.NumberFormat(languages, {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'narrow',
  })
  if (!durationS) return secondsFormat.format(0)

  const seconds = Math.trunc(durationS % 60)
  const minutes = Math.trunc(durationS / 60)

  if (DurationFormat) return new DurationFormat(languages, { style: 'narrow' }).format({ minutes, seconds })

  const minutesFormat = new Intl.NumberFormat(languages, {
    style: 'unit',
    unit: 'minute',
    unitDisplay: 'narrow',
  })

  if (!seconds) return minutesFormat.format(minutes)
  return `${minutes ? `${minutesFormat.format(minutes)} ` : ''}${secondsFormat.format(seconds)}s`
}

export const getMediaElementInfo = async (source: Blob | string) => {
  const { promise, close } = loadAsyncImageSource(source, undefined, true)

  const media = await promise
  const duration = media.duration
  const media_: any = media
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  const hasAudio = !!(media_.audioTracks?.length || media_.mozHasAudio || media_.webkitAudioDecodedByteCount)

  close()

  return {
    duration,
    hasAudio,
    width: media.videoWidth,
    height: media.videoHeight,
  }
}

export const getContainerInfo = async (source: Blob | string) => {
  const demuxer = new MP4Demuxer()
  const isBlob = typeof source !== 'string'
  const url = isBlob ? URL.createObjectURL(source) : source

  try {
    return await demuxer.init(url)
  } finally {
    demuxer.stop()
    if (isBlob) URL.revokeObjectURL(url)
  }
}

export const seekAndWait = async (video: HTMLVideoElement, timeS: number, signal: AbortSignal) => {
  const p = promiseWithResolvers<unknown>()

  const onError = () => p.reject(video.error ?? new Error('Unkown error'))
  const onAbort = () => p.reject(new Error('Aborted'))

  const stateChangeEvents = ['load', 'canplay', 'seeked']
  const onReadyStateChange = () => video.readyState >= 2 && p.resolve(undefined)

  stateChangeEvents.forEach((type) => video.addEventListener(type, onReadyStateChange, { once: true }))
  video.addEventListener('error', onError, { once: true })
  signal.addEventListener('abort', onAbort, { once: true })

  video.currentTime = timeS

  await p.promise.finally(() => {
    stateChangeEvents.forEach((type) => video.removeEventListener(type, onReadyStateChange))
    video.removeEventListener('seeked', onReadyStateChange)
    signal.removeEventListener('abort', onAbort)
  })
}

export const getImageSize = (image: TexImageSource): Size => {
  if ('videoWidth' in image) return { width: image.videoWidth, height: image.videoHeight }
  if ('naturalWidth' in image) return { width: image.naturalWidth, height: image.naturalHeight }
  if ('codedWidth' in image) return { width: image.codedWidth, height: image.codedHeight }
  return { width: image.width, height: image.height }
}

export const checkAndWarnVideoFile = (
  type: 'audio' | 'video',
  file: Blob,
  translate = (text: string) => text,
) => {
  const mime = file.type.replace('quicktime', 'mp4')
  if (!document.createElement(type).canPlayType(mime)) {
    alert(`${translate(`Your browser can't play this file type`)} (${file.type})`)
    return false
  }

  if (!/video\/(mp4|mov|quicktime)/.test(file.type))
    alert(translate('Export is currently only supported for MP4 source videos!'))

  return true
}

export const useRafLoop = (
  callback: (timestamp: number) => void,
  options?: { active?: MaybeRefOrGetter<boolean> },
) => {
  return watch([() => toValue(options?.active) ?? true], ([active], _prev, onCleanup) => {
    if (!active) return

    let id = 0

    const loop = (t: number) => {
      callback(t)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)

    onCleanup(() => cancelAnimationFrame(id))
  })
}

export const useInterval = (
  callback: () => unknown,
  interval: number,
  options?: { active?: MaybeRefOrGetter<boolean> },
) => {
  effect((onCleanup) => {
    const active = toValue(options?.active) ?? true
    if (!active) return

    const id = setInterval(callback, interval)
    onCleanup(() => clearInterval(id))
  })
}
