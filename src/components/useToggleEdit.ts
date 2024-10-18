import { ImageSourceState } from '@/engine/ImageSourceState'
import { MaybeRefOrGetter, ref, toRef, toValue, watch } from '@/framework/reactivity'
import { ImageEditState } from '@/types'

export const useTogleEdit = <T extends keyof ImageEditState>(
  source: MaybeRefOrGetter<ImageSourceState | undefined>,
  key: T,
) => {
  const savedValue = ref<ImageEditState[T]>()

  // clear prev toggle value on source change
  watch([toRef(source)], () => (savedValue.value = undefined))

  const toggle = () => {
    const $source = toValue(source)
    if (!$source) return

    if (savedValue.value) {
      $source[key].value = savedValue.value
      clearSavedValue()
    } else {
      savedValue.value = $source[key].value as ImageEditState[T]
      $source[key].value = undefined
    }
  }

  const clearSavedValue = () => {
    savedValue.value = undefined
  }

  return {
    toggle,
    clearSavedValue,
    isToggledOff: toRef(() => savedValue.value !== undefined),
    hasValue: toRef(() => toValue(source)?.[key].value !== undefined),
  }
}
