import { type Component, type MaybeRef, type MaybeRefOrGetter, toRef, toValue, unref } from 'fine-jsx'

import { IconButton } from './icon-button'

export const ToggleButton = ({
  isActive,
  onToggle,
  activeIcon,
  inactiveIcon,
  class: className,
  children,
  ...props
}: {
  isActive: MaybeRefOrGetter<boolean>
  onToggle: (shouldPause: boolean) => unknown
  class?: unknown
  activeIcon: MaybeRef<Component>
  inactiveIcon: MaybeRef<Component>
  children?: JSX.Element | JSX.Element[]
  [key: string]: unknown
}) => (
  <IconButton
    {...props}
    icon={toRef(() => (toValue(isActive) ? unref(activeIcon) : unref(inactiveIcon)))}
    class={className}
    onClick={() => onToggle(!toValue(isActive))}
  >
    {children}
  </IconButton>
)
