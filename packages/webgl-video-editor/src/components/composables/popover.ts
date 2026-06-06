import { effect, ref } from 'fine-jsx'
import { uid } from 'uid'

import { useEventListener } from 'shared/utils'

export class PopoverContext {
  id = uid()
  isOpen = ref(false)
  trigger = ref<HTMLButtonElement>()
  popover = ref<HTMLElement>()

  constructor() {
    useEventListener(this.popover, 'toggle', (event: ToggleEvent) => {
      const newValue = (this.isOpen.value = event.newState === 'open')

      if (newValue) {
        // chrome doesn't autofocus if the children are rendered after opening
        void Promise.resolve().then(() =>
          this.popover.value?.querySelector<HTMLElement>('[autofocus]')?.focus(),
        )
      }
    })

    effect(() => {
      const trigger = this.trigger.value
      const popover = this.popover.value

      if (!trigger || !popover) return

      trigger.popoverTargetElement = popover
      popover.popover = 'auto'
    })
  }

  scopedId(part: string): string {
    return `${part}-${this.id}`
  }

  close() {
    if (this.isOpen.value) this.popover.value?.hidePopover()
  }
}
