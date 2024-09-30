import { MaybeRefOrGetter, onScopeDispose, ref, toValue, watch } from '@/framework/reactivity'
import { throttle } from 'throttle-debounce'

export const useElementSize = (element: MaybeRefOrGetter<HTMLElement | null | undefined>) => {
  const initialElement = toValue(element)
  const size = ref({
    width: initialElement?.offsetWidth ?? 0,
    height: initialElement?.offsetHeight ?? 0,
  })

  const observer = new ResizeObserver(([entry]) => {
    const { contentBoxSize } = entry

    if (contentBoxSize) {
      const sizeItem = Array.isArray(contentBoxSize) ? contentBoxSize[0] : contentBoxSize
      size.value = { width: sizeItem.inlineSize, height: sizeItem.blockSize }
    } else {
      size.value = { width: entry.contentRect.width, height: entry.contentRect.height }
    }
  })

  watch([() => toValue(element)], ([el], _prev, onCleanup) => {
    if (!el) return

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
    if (!child || !container) return

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
