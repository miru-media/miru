import { h, render } from 'fine-jsx'

import { setShadowStyles } from './set-shadow-styles.ts'

export const renderComponentTo = <P extends Record<string, unknown>>(
  Component: (props: P) => JSX.Element,
  props: P,
  node: HTMLElement,
) => {
  if (import.meta.env.SSR) return () => undefined

  const shadow = node.attachShadow({ mode: 'open' })

  setShadowStyles(shadow)

  return render(h(Component as never, props), shadow)
}
