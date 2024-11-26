import { type Component } from 'shared/framework/jsx-runtime'
import { type MaybeRef, type MaybeRefOrGetter, toRef, toValue, unref } from 'shared/framework/reactivity'

import { IconButton } from './IconButton'

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
