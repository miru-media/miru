import { h, render } from 'fine-jsx'

import styles from '../css/index.module.css'

export const renderComponentTo = <P extends Record<string, unknown>>(
  Component: (props: P) => JSX.Element,
  props: P,
  node: HTMLElement,
) => {
  if (import.meta.env.SSR) return () => undefined

  node.classList.add('media-editor', styles.host)

  node.setAttribute(
    'color-scheme',
    node.hasAttribute('color-scheme')
      ? node.getAttribute('color-scheme')!
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light',
  )

  return render(h(Component as never, props), node)
}
