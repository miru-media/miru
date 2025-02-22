import {
  computed,
  effect,
  inject,
  type MaybeRefOrGetter,
  onScopeDispose,
  provide,
  ref,
  toRef,
  toValue,
  watch,
} from 'fine-jsx'
import { throttle } from 'throttle-debounce'

import { win } from './window'

export const useElementSize = (element: MaybeRefOrGetter<HTMLElement | null | undefined>) => {
  const initialElement = toValue(element)
  const size = ref({
    width: initialElement?.offsetWidth ?? 0,
    height: initialElement?.offsetHeight ?? 0,
  })

  const observer = new ResizeObserver(([entry]) => {
    if ('contentBoxSize' in (entry as never)) {
      const { contentBoxSize } = entry

      const sizeItem = (
        Array.isArray(contentBoxSize) ? contentBoxSize[0] : contentBoxSize
      ) as ResizeObserverSize
      size.value = { width: sizeItem.inlineSize, height: sizeItem.blockSize }
    } else {
      size.value = { width: entry.contentRect.width, height: entry.contentRect.height }
    }
  })

  watch([() => toValue(element)], ([el], _prev, onCleanup) => {
    if (el == undefined) return

    observer.observe(el)
    onCleanup(() => observer.unobserve(el))
  })

  onScopeDispose(observer.disconnect.bind(observer))

  return size
}

export const useAppendChild = (
  container: MaybeRefOrGetter<HTMLElement | null | undefined | string>,
  child: MaybeRefOrGetter<HTMLElement | null | undefined>,
) => {
  const getContainer = () => {
    const element = toValue(container)
    if (typeof element === 'string') return document.querySelector(element)
    return element
  }

  watch([getContainer, () => toValue(child)], ([container, child], _prev, onCleanup) => {
    if (child == null || container == null) return

    container.appendChild(child)
    onCleanup(child.remove.bind(child))
  })
}

export const useThrottle = <T>(delay: number, value: MaybeRefOrGetter<T>) => {
  const throttledValue = ref(toValue(value))
  const throttledFn = throttle(delay, (newValue: T) => {
    throttledValue.value = newValue
  })

  watch([() => toValue(value)], ([v]) => throttledFn(v))
  onScopeDispose(throttledFn.cancel)

  return throttledValue
}

export const arrayFlatToValue = <T>(value: T | T[], result: T[] = []): T[] => {
  const val = toValue(value)

  if (Array.isArray(val)) val.forEach((v) => arrayFlatToValue(v, result))
  else result.push(val)

  return result
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const useEventListener = <T extends Event>(
  targetRef: MaybeRefOrGetter<EventTarget | undefined>,
  type: string,
  listener: (event: T) => void,
  options?: AddEventListenerOptions,
) =>
  effect((onCleanup) => {
    const target = toValue(targetRef)
    if (target == undefined) return

    target.addEventListener(type, listener as (event: Event) => void, options)
    onCleanup(() => target.removeEventListener(type, listener as (event: Event) => void, options))
  })

const supportsHover = ref(false)
if ('matchMedia' in win) {
  const query = win.matchMedia('(hover: hover)')
  supportsHover.value = query.matches
  query.addEventListener('change', () => (supportsHover.value = query.matches))
}

export const useHoverCoords = (targetRef: MaybeRefOrGetter<EventTarget | undefined>) => {
  const coords = ref({ x: 0, y: 0 })

  useEventListener(
    () => (supportsHover.value ? toValue(targetRef) : undefined),
    'pointermove',
    (event: PointerEvent) => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()

      coords.value = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    },
  )

  return coords
}

export const useDocumentVisibility = (doc = document) => {
  const isVisible = ref(doc.visibilityState === 'visible')

  useEventListener(doc, 'visibilitychange', () => (isVisible.value = doc.visibilityState === 'visible'))

  return isVisible
}

interface I18nOptions {
  translations: Record<string, Record<string, string>>
  languages?: MaybeRefOrGetter<string[]>
}

export const createI18n = (options: I18nOptions) => {
  const languages = toRef(options.languages ?? (navigator.languages as string[]))
  const messages = computed(() => {
    const { translations } = options
    const language = languages.value.find((l) => l in translations)

    return language === undefined ? undefined : translations[language]
  })

  const t = (key: string) => messages.value?.[key] ?? key

  return { t, messages, languages }
}

export const provideI18n = (options: I18nOptions) => {
  const i18n = createI18n(options)
  provide('i18n', i18n)
  return i18n
}

export const useI18n = () => {
  return inject<ReturnType<typeof createI18n>>('i18n')!
}
