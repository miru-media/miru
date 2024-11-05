import { type Component } from '@/framework/jsx-runtime'
export const IconButton = ({
  icon: IconComponent,
  onClick,
  ...props
}: {
  icon: Component
  onClick: (event: Event) => unknown
  [key: string]: unknown
}) => {
  return (
    <button type="button" onClick={onClick} {...props}>
      <IconComponent />
    </button>
  )
}
