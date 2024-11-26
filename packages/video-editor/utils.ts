import { computed, effect, type MaybeRefOrGetter, onScopeDispose, ref, toValue } from 'shared/framework/reactivity'
import { decodeAsyncImageSource, promiseWithResolvers, useEventListener } from 'shared/utils'

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
  const events = ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'waiting', 'stalled']

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

export const formatDuration = (durationS: number) => {
  const seconds = Math.round(durationS)
  const minutes = Math.trunc(seconds / 60)

  return `${minutes ? `${minutes}m ` : ''}${seconds % 60}s`
}

export const getVideoInfo = async (source: Blob | string) => {
  const { media, promise, close } = decodeAsyncImageSource(source, undefined, true)

  await promise
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
