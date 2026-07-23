import { ref, type Ref } from 'fine-jsx'
import type { ViteHotContext } from 'vite/types/hot.js'

export interface CssModuleHmrData {
  ref: Ref<CSSModuleClasses>
  proxy: CSSModuleClasses
}

export const getCssModuleHmrProxy = (hot: ViteHotContext, styles: CSSModuleClasses): CSSModuleClasses => {
  const data = hot.data as Partial<CssModuleHmrData>

  if (data.ref && data.proxy) {
    data.ref.value = styles
    return data.proxy
  } else data.ref = ref(styles)

  data.proxy ??= new Proxy(data.ref, {
    get: (stylesRef, key) => stylesRef.value[key as string],
  }) as unknown as CSSModuleClasses

  return data.proxy
}
