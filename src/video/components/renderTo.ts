import { h, render } from '@/framework/jsx-runtime'

import { setShadowStyles } from './setShadowStyles'

export const renderComponentTo = <P extends Record<string, unknown>>(
  Component: (props: P) => JSX.Element,
  props: P,
  node: HTMLElement,
) => {
  node.classList.add('miru-video-editor')

  setShadowStyles(node.ownerDocument)

  return render(h(Component as never, props), node)
}
