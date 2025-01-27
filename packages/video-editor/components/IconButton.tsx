import { type Component, h, type MaybeRef, unref } from 'fine-jsx'

export const IconButton = ({
  icon,
  onClick,
  children,
  class: className,
  iconClass,
  tag = 'button',
  ...props
}: {
  icon: MaybeRef<Component<{ class?: unknown }>>
  tag?: string
  class?: unknown
  iconClass?: unknown
  onClick?: (event: Event) => unknown
  [key: string]: unknown
}) => {
  const buttonProps = {
    class: () => ['icon-button', className],
    onClick,
    children: [
      () => {
        const IconComponent = unref(icon)
        return <IconComponent class={['icon', iconClass]} />
      },
      children,
    ],
    ...(tag === 'button' ? { type: 'button' } : null),
    ...props,
  }

  return h(tag, buttonProps)
}
