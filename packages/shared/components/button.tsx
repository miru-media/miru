import { h, type MaybeRefOrGetter } from 'fine-jsx'

import styles from '../css/shared.module.css'

export const Button = ({
  onClick,
  label,
  tag = 'button',
  class: className,
  ...props
}: {
  tag?: string
  label?: MaybeRefOrGetter<string>
  class?: unknown
  onClick?: (event: Event) => unknown
  [key: string]: unknown
}) => {
  const buttonProps = {
    class: () => [className, styles.button],
    onClick,
    ...(tag === 'button' ? { type: 'button' } : { role: 'button' }),
    title: label,
    'aria-label': label,
    ...props,
  }

  return h(tag, buttonProps)
}
