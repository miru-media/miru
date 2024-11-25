import { h, render } from '@/framework/jsx-runtime'

import { setShadowStyles } from './setShadowStyles'

export const renderComponentTo = <P extends Record<string, unknown>>(
  Component: (props: P) => JSX.Element,
  props: P,
  node: HTMLElement,
) => {
  node.classList.add('media-editor')

  node.setAttribute(
    'color-scheme',
    node.hasAttribute('color-scheme')
      ? node.getAttribute('color-scheme')!
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light',
  )

  const shadow = node.attachShadow({ mode: 'open' })

  setShadowStyles(shadow)

  return render(h(Component as never, props), shadow)
}
