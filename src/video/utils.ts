import { computed, effect, type MaybeRefOrGetter, onScopeDispose, ref, toValue } from '@/framework/reactivity'
import { decodeAsyncImageSource, useEventListener } from '@/utils'

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

export const formatTime = (timeS: number) => {
  const { minutes, hours, seconds, subSeconds } = splitTime(timeS)

  return `${hours === '00' ? '' : `${hours}:`}${minutes}:${seconds}.${subSeconds}`
}

export const getVideoInfo = async (source: Blob | string) => {
  const { media, promise, close } = decodeAsyncImageSource(source, undefined, true)

  await promise
  const duration = media.duration
  close()

  return { duration }
}
