// eslint-disable-next-line import/no-unresolved
import css from 'virtual:shadow.css'

import { h, render } from '@/framework/jsx-runtime'

export const renderComponentTo = <P extends Record<string, unknown>>(
  Component: (props: P) => JSX.Element,
  props: P,
  node: HTMLElement,
) => {
  node.classList.add('miru-image-editor')

  node.setAttribute(
    'color-scheme',
    node.hasAttribute('color-scheme')
      ? node.getAttribute('color-scheme')!
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light',
  )

  const root = node.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.style.display = 'none'
  style.textContent = css
  root.appendChild(style)

  return render(h(Component as never, props), root)
}
