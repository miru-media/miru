import { type Component } from '@/framework/jsx-runtime'
import { type MaybeRef, unref } from '@/framework/reactivity'

export const IconButton = ({
  icon,
  onClick,
  children,
  class: className,
  ...props
}: {
  icon: MaybeRef<Component>
  onClick: (event: Event) => unknown
  [key: string]: unknown
}) => {
  return (
    <button type="button" class={() => ['icon-button', className]} onClick={onClick} {...props}>
      {() => {
        const IconComponent = unref(icon)
        return <IconComponent />
      }}
      {children}
    </button>
  )
}
