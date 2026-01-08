import { h, render } from 'fine-jsx'

export const renderComponentTo = <P extends Record<string, unknown>>(
  Component: (props: P) => JSX.Element,
  props: P,
  node: HTMLElement,
) => {
  if (import.meta.env.SSR) return () => undefined

  return render(h(Component as never, props), node)
}
