import { computed, effect, isRef, type MaybeRefOrGetter, onScopeDispose, ref, toValue } from 'fine-jsx'
import type * as Vue from 'vue'

export const toVue = <T>(
  customRef: typeof Vue.customRef,
  onScopeDispose: typeof Vue.onScopeDispose,
  fineJsxSource: MaybeRefOrGetter<T>,
  set = (newValue: T) => {
    if (!isRef(fineJsxSource)) throw new Error('[fine-jsx] Value is not a writable ref.')
    fineJsxSource.value = newValue
  },
): Vue.Ref<T> => {
  return customRef<T>((track, trigger) => {
    let stopEffect: (() => void) | undefined
    let isDisposed = false

    onScopeDispose(() => {
      stopEffect?.()
      isDisposed = true
    })

    return {
      get() {
        track()
        if (!stopEffect && !isDisposed)
          stopEffect = effect(() => {
            toValue(fineJsxSource)
            trigger()
          })

        return toValue(fineJsxSource)
      },
      set(newValue) {
        set(newValue)
        trigger()
      },
    }
  })
}

export const fromVue = <T>(
  vueToValue: typeof Vue.toValue,
  vueWatchEffect: typeof Vue.watchEffect,
  vueSource: Vue.MaybeRefOrGetter<T>,
) => {
  const fineRef = ref<T>(undefined as never)

  onScopeDispose(
    vueWatchEffect(
      () => {
        // trigger
        fineRef.value = vueToValue(vueSource)
      },
      { flush: 'sync' },
    ),
  )

  return computed(() =>
    // track
    toValue(fineRef.value),
  )
}
