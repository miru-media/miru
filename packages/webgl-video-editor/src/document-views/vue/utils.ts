import type { MaybeRefOrGetter } from 'fine-jsx'
import * as Vue from 'vue'

import * as interop from 'shared/utils/interop'

import type * as pub from '../../../types/core'

import type { VueDocument } from './vue-document.ts'
import type { VueNodeView } from './vue-nodes.ts'

export const toVue = interop.toVue.bind(null, Vue.customRef, Vue.onScopeDispose) as <T>(
  source: MaybeRefOrGetter<T>,
  set?: (newValue: T) => unknown,
) => Vue.Ref<T>

export const fromVue = interop.fromVue.bind(null, Vue.toValue, Vue.watchEffect) as <T>(
  source: MaybeRefOrGetter<T>,
) => Vue.Ref<T>

export type MethodKey<T> =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- needed
  keyof { [P in keyof T as T[P] extends Function ? P : never]: unknown }
export type NonMethodKey<T extends pub.AnyNode | pub.Document> = Extract<keyof T, string>

export function _vueNodeProp<T extends pub.AnyNode | pub.Document>(
  view: any,
  original: T,
  key: keyof T,
): void {
  const vueRef = toVue(
    () => (view.docView as VueDocument)._getNode((original as Record<typeof key, any>)[key]),
    (newValue: VueNodeView<pub.AnyNode>) =>
      ((original as Record<typeof key, any>)[key] = (view.docView as VueDocument)._getNode(
        newValue as any,
      ).original),
  )

  Object.defineProperty(view, key, {
    get: () => vueRef.value,
    set: (newValue) => void (vueRef.value = newValue),
    configurable: true,
    enumerable: true,
  })
}

export function _vueNodeArrayProp<T extends pub.AnyNode | pub.Document>(
  view: any,
  original: T,
  key: keyof T,
): void {
  const vueRef = toVue(() => {
    const docView = view.docView as VueDocument
    const original_ = original as Record<typeof key, VueNodeView<any>[]>
    return original_[key].map((node) => docView._getNode(node as any))
  })

  Object.defineProperty(view, key, {
    get: () => vueRef.value,
    set: (newValue) => void (vueRef.value = newValue),
    configurable: true,
    enumerable: true,
  })
}

export function _vueWritable<T extends pub.AnyNode | pub.Document>(
  view: any,
  original: T,
  key: keyof T,
): void {
  const vueRef = toVue(
    () => original[key],
    (value) => (original[key] = value),
  )

  Object.defineProperty(view, key, {
    get: () => vueRef.value,
    set: (value: any) => {
      vueRef.value = value
    },
    configurable: true,
    enumerable: true,
  })
}

export function _vuePlainReadonly<T extends pub.AnyNode | pub.Document>(
  view: any,
  original: T,
  key: keyof T,
): void {
  const vueRef = toVue(() => original[key])

  Object.defineProperty(view, key, {
    get: () => vueRef.value,
    configurable: true,
    enumerable: true,
  })
}

export function _bindMethod<T extends pub.AnyNode | pub.Document>(
  view: any,
  original: T,
  key: MethodKey<T>,
): void {
  const unbound = original[key]
  view[key] = (unbound as () => any).bind(original) as T[typeof key]
}
