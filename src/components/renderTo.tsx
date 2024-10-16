import { h, render } from '@/framework/jsx-runtime'

import css from 'virtual:shadow.css'

export const renderComponentTo = <C extends (props: P) => JSX.Element, P extends Record<string, unknown>>(
  Component: C,
  props: P,
  node: HTMLElement,
) => {
  let root

  node.classList.add('miru-image-editor')

  node.setAttribute(
    'color-scheme',
    node.hasAttribute('color-scheme')
      ? node.getAttribute('color-scheme')!
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light',
  )

  if (import.meta.env.VITE_NO_SHADOW_ROOT) {
    root = node
  } else {
    root = node.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.style.display = 'none'
    style.textContent = css
    root.appendChild(style)
  }

  return render(h(Component as never, props), root)
}
