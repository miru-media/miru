import { inject, type MaybeRefOrGetter, provide, ref, toValue } from 'fine-jsx'

import { clamp, useEventListener } from 'shared/utils'

import styles from '../../css/index.module.css'
import { PopoverContext } from '../composables/popover.ts'

interface MenuOption<T = unknown> {
  label: MaybeRefOrGetter<string | JSX.Element>
  value: T
}

const DROPDOWN_KEY = Symbol('dropdown')
export const Dropdown = (props: {
  label: MaybeRefOrGetter<string | JSX.Element>
  // passing the content as a function allows it to pick up the dropdown's provided context
  content: () => JSX.Element
  menuId?: MaybeRefOrGetter<string>
}) => {
  const root = ref<HTMLElement>()

  const context = new PopoverContext()
  provide(DROPDOWN_KEY, context)

  return (
    <div ref={root} class={styles.dropdown}>
      <button
        ref={context.trigger}
        type="button"
        id={context.scopedId('trigger')}
        aria-expanded={context.isOpen}
        class={styles.dropdownTrigger}
      >
        <div class={styles.dropdownTriggerLabel}>{props.label}</div>

        <IconMsArrowDownwardRounded class={styles.dropdownTriggerArrow} />
      </button>

      <div ref={context.popover} id={context.scopedId('popover')} class={styles.dropdownPopover}>
        {() => context.isOpen.value && props.content()}
      </div>
    </div>
  )
}

export function DropdownMenu<T = unknown>({
  options,
  class: className,
  onSelect,
  ...elementProps
}: {
  options: MenuOption<T>[]
  class?: unknown
  onSelect: (value: T) => unknown
  [index: string]: unknown
}): JSX.Element {
  const context = inject<PopoverContext>(DROPDOWN_KEY)!
  const current = ref(-1)

  const onFocusItem = (event: Event, i: number) => {
    current.value = i
    ;(event.target as HTMLElement).tabIndex = 0
  }

  const onClickItem = (option: MenuOption<T>) => {
    onSelect(option.value)
    context.close()
  }

  useEventListener(context.popover, 'keydown', (event: KeyboardEvent) => {
    if (/^Arrow(?:Up|Dow|Left|Right)/u.test(event.code)) {
      const delta = /Down|Right/u.test(event.code) ? 1 : -1
      const newItemIndex = clamp(current.value + delta, 0, options.length - 1)
      const itemEl = document.getElementById(context.scopedId(`menuitem${newItemIndex}`))

      itemEl?.focus()
      event.stopPropagation()
      event.preventDefault()
    }
  })

  const onKeydownItem = (event: KeyboardEvent) => {
    if (event.code === 'Enter') {
      ;(event.currentTarget as HTMLElement).click()
      event.preventDefault()
    }
  }

  return (
    <ul
      {...elementProps}
      id={() => context.scopedId('menu')}
      role="menu"
      aria-labelledby={context.scopedId('trigger')}
      class={[styles.dropdownMenu, className]}
      onKeydownMenu={onKeydownItem}
    >
      {toValue(options).map((option, i) => {
        const getIsSelected = () => current.value === i || (current.value === -1 && i === 0)

        return (
          <li
            role="menuitem"
            id={context.scopedId(`menuitem${i}`)}
            class={[styles.dropdownMenuItem]}
            autofocus={getIsSelected}
            tabIndex={() => (getIsSelected() ? 0 : -1)}
            onClick={() => onClickItem(option)}
            onKeydown={onKeydownItem}
            onFocus={(event: Event) => onFocusItem(event, i)}
            onPointerenter={(event: Event) => (event.target as HTMLElement).focus()}
          >
            {option.label}
          </li>
        )
      })}
    </ul>
  )
}
