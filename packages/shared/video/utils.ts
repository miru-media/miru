import { computed, effect, type MaybeRefOrGetter, onScopeDispose, ref, toValue, watch } from 'fine-jsx'

import type { Size } from 'shared/types'
import { promiseWithResolvers, useEventListener, win } from 'shared/utils'

import { IS_LIKE_MAC, IS_SAFARI_16 } from '../userAgent.ts'

import { EXPORT_VIDEO_CODECS, ReadyState } from './constants.ts'

export const hasVideoDecoder = () => typeof VideoDecoder === 'function'
export const hasAudioDecoder = () => typeof AudioDecoder === 'function'

export const assertDecoderConfigIsSupported = async (
  type: 'audio' | 'video',
  config: AudioDecoderConfig | VideoDecoderConfig,
) => {
  if (type === 'audio') {
    if (!hasAudioDecoder()) throw new Error('Missing AudioDecoder API.')
  } else if (!hasVideoDecoder()) throw new Error('Missing VideoDecoder API.')

  const support = await (type === 'audio'
    ? AudioDecoder.isConfigSupported(config as AudioDecoderConfig)
    : VideoDecoder.isConfigSupported(config as VideoDecoderConfig))

  if (!support.supported)
    throw new Error(`Decoding ${type} config "${config.codec}" is not supported by the user agent.`)
}

export const assertCanExtractVideoFrames = () => {
  if (!hasVideoDecoder()) throw new Error('Missing VideoDecoder and requestVideoFrameCallback APIs.')
}

export const assertEncoderConfigIsSupported = async (
  type: 'audio' | 'video',
  config: AudioEncoderConfig | VideoEncoderConfig,
  Encoder = type === 'audio' ? win.AudioEncoder : win.VideoEncoder,
) => {
  if (typeof Encoder === 'undefined')
    throw new Error(`Missing ${type === 'audio' ? 'Audio' : 'Video'}Encoder API.`)

  const support = await Encoder.isConfigSupported(config as any)
  if (IS_SAFARI_16 && IS_LIKE_MAC) throw new Error(`VideoEncoder doesn't work on Safari 16.`)

  if (!support.supported)
    throw new Error(`Encoding ${type} config '${JSON.stringify(config)}' is not supported by the user agent.`)
}

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
  const readyState = ref<ReadyState>(0)
  const updateValue = () =>
    (readyState.value = (toValue(media)?.readyState ?? ReadyState.HAVE_NOTHING) as ReadyState)
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
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- decimal to padded whole number
  const subSeconds = String(Math.trunc((timeS % 1) * 100)).padStart(2, '0')

  return { minutes, hours, seconds, subSeconds }
}

export const formatTime = (timeS: number, withSubSeconds = true) => {
  const { minutes, hours, seconds, subSeconds } = splitTime(timeS)

  return `${hours === '00' ? '' : `${hours}:`}${minutes}:${seconds}${withSubSeconds ? `.${subSeconds}` : ''}`
}

const { DurationFormat } = Intl as unknown as {
  DurationFormat?: new (...args: unknown[]) => { format: (...args: unknown[]) => string }
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
  return `${minutes ? `${minutesFormat.format(minutes)} ` : ''}${secondsFormat.format(seconds)}`
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

export const useRafLoop = (
  callback: (timestamp: number) => void,
  options?: { active?: MaybeRefOrGetter<boolean> },
) =>
  watch([() => toValue(options?.active) ?? true], ([active], _prev, onCleanup) => {
    if (!active) return

    let id = 0

    const loop = (t: number) => {
      callback(t)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)

    onCleanup(() => cancelAnimationFrame(id))
  })

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

export const setVideoEncoderConfigCodec = async (
  config: VideoEncoderConfig,
  codecs = EXPORT_VIDEO_CODECS,
) => {
  let firstError: unknown
  let foundSupportedCodec = false

  for (const codec of [config.codec, ...codecs]) {
    if (!codec) continue

    try {
      config.codec = codec
      await assertEncoderConfigIsSupported('video', config)
      foundSupportedCodec = true
      break
    } catch (error) {
      firstError ??= error
    }
  }

  if (!foundSupportedCodec) throw firstError
}

export const rangeContainsTime = (range: { start: number; end: number }, time: number): boolean =>
  range.start <= time && time < range.end
