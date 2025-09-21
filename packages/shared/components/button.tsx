import { h, type MaybeRefOrGetter, toValue } from 'fine-jsx'

export const Button = ({
  onClick,
  label,
  tag = 'button',
  class: className,
  part,
  ...props
}: {
  tag?: string
  label?: MaybeRefOrGetter<string>
  class?: unknown
  part?: MaybeRefOrGetter<string>
  onClick?: (event: Event) => unknown
  [key: string]: unknown
}) => {
  const buttonProps = {
    class: () => [className, 'button'],
    part: () => ['button', toValue(part) ?? ''].filter(Boolean).join(' '),
    onClick,
    ...(tag === 'button' ? { type: 'button' } : { role: 'button' }),
    title: label,
    'aria-label': label,
    x: 'blah',
    ...props,
  }

  return h(tag, buttonProps)
}
