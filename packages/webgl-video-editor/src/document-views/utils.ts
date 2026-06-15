import { effect, type MaybeRefOrGetter, toValue } from 'fine-jsx'

import type { Size } from 'shared/types'
import { setObjectSize, useEventListener } from 'shared/utils'

export const defineWrapperProps = <
  TTarget extends { prototype: TSource & Record<TSourceField, TSource> },
  TSource,
  TSourceField extends string,
>(
  Target: TTarget,
  keyToSource: TSourceField,
  props: (keyof TSource)[],
) => {
  for (const key of props)
    Object.defineProperty(Target.prototype, key, {
      get(this: TTarget['prototype']) {
        return this[keyToSource][key]
      },
      set(this: TTarget['prototype'], value: TSource[typeof key]) {
        ;(this[keyToSource][key] as any) = value
      },
      enumerable: true,
    })
}

export const usePlaceholderImage = (options: {
  text: MaybeRefOrGetter<string>
  size: MaybeRefOrGetter<Size>
  color?: MaybeRefOrGetter<string | undefined>
  onLoad?: () => void
}) => {
  const canvas = document.createElement('canvas')
  const img = new Image()

  useEventListener(img, 'load', () => {
    canvas.getContext('2d')?.drawImage(img, 0, 0)
    options.onLoad?.()
  })

  effect(() => {
    const text = toValue(options.text)
    const size = toValue(options.size)
    const color =
      toValue(options.color)?.replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') ??
      'gray'

    setObjectSize(canvas, size)
    const div = document.createElement('div')
    div.textContent = toValue(options.text)

    const svg = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
 <style>
 .placeholder-text {
  color: white;
  background: black;
  font-family: 'Liberation Sans', -apple-system, system-ui, sans-serif;
  font-size: ${Math.min(size.width, size.height) / text.length}px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 5%;
  border: dashed 0.5rem ${color};
}
</style>
<foreignObject width="100%" height="100%"><div class="placeholder-text" xmlns="http://www.w3.org/1999/xhtml">${div.innerHTML}</div></foreignObject>
</svg>`
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })

  return canvas
}
