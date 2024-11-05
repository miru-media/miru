import { type Component } from '@/framework/jsx-runtime'
import { isRef, type MaybeRef } from '@/framework/reactivity'

export const IconButton = ({
  icon,
  onClick,
  ...props
}: {
  icon: MaybeRef<Component>
  onClick: (event: Event) => unknown
  [key: string]: unknown
}) => {
  return (
    <button type="button" onClick={onClick} {...props}>
      {() => {
        const IconComponent = isRef(icon) ? icon.value : icon
        return <IconComponent />
      }}
    </button>
  )
}
