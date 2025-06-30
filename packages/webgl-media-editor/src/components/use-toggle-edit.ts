import { type MaybeRefOrGetter, ref, toRef, toValue, watch } from 'fine-jsx'

import { type ImageSourceInternal } from '../image-source-internal'

export const useToggleEdit = <T>(
  source: MaybeRefOrGetter<ImageSourceInternal | undefined>,
  getCurrentValue: (source: ImageSourceInternal | undefined) => T,
  setValue: (source: ImageSourceInternal, value: T) => unknown,
  defaultValue: (soruce: ImageSourceInternal | undefined) => T,
) => {
  const sourceRef = toRef(source)
  const savedValue = ref<T>()
  const clearSavedValue = () => {
    savedValue.value = defaultValue(sourceRef.value)
  }

  // clear prev toggle value on source change
  watch([sourceRef], clearSavedValue)

  const toggle = () => {
    const $source = toValue(source)
    if ($source == undefined) return

    const _defaultValue = defaultValue($source)
    if (savedValue.value === _defaultValue) {
      savedValue.value = getCurrentValue($source)
      setValue($source, _defaultValue)
    } else {
      setValue($source, savedValue.value as T)
      clearSavedValue()
    }
  }

  return {
    toggle,
    clearSavedValue,
    isToggledOff: toRef(
      () => sourceRef.value != undefined && savedValue.value !== defaultValue(sourceRef.value),
    ),
  }
}
