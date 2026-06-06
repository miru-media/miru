import { type MaybeRefOrGetter, ref } from 'fine-jsx'

import { useI18n } from 'shared/utils/composables.ts'

import styles from '../../css/index.module.css'

export const Drawer = (props: {
  id: string
  title: MaybeRefOrGetter<string | JSX.Element>
  onCancel?: (returnValue: string) => boolean
  onClose?: (returnValue: string) => unknown
  onConfirm?: () => unknown
  content: () => JSX.Element
}) => {
  const { t } = useI18n()
  const isOpen = ref(false)
  const dialog = ref<HTMLDialogElement>()

  const onCancel = (event: Event) => {
    if (props.onCancel?.(dialog.value!.returnValue) === false) event.preventDefault()
  }

  const onClose = (): void => {
    isOpen.value = false
    props.onClose?.(dialog.value!.returnValue)
  }

  const onToggle = (event: ToggleEvent) => (isOpen.value = event.newState === 'open')

  const onClickConfirm = () => {
    if (props.onConfirm?.() === true) dialog.value?.close()
  }

  return (
    <dialog
      ref={dialog}
      class={styles.drawer}
      id={props.id}
      closedby="any"
      {...{ onCancel, onClose, onToggle }}
    >
      {() =>
        isOpen.value ? (
          <>
            <div class={styles.drawerHeader}>
              <button
                type="button"
                label={t('close')}
                class={styles.drawerButton}
                command="close"
                commandfor={props.id}
                value="close"
              >
                <IconMsCloseRounded class={styles.icon} />
              </button>

              <h1 class={styles.textGreat}>{props.title}</h1>

              {props.onConfirm && (
                <button
                  type="button"
                  label={t('dialog_confirm')}
                  class={styles.drawerButton}
                  onClick={onClickConfirm}
                >
                  <IconMsCheckRounded class={styles.icon} />
                </button>
              )}
            </div>

            <div class={styles.drawerBody}>{props.content}</div>
          </>
        ) : (
          // for browsers that don't support a "toggle" event on dialogs,
          // change isOpen to true when this child element is autofocused
          <div autofocus onFocus={() => (isOpen.value = true)} />
        )
      }
    </dialog>
  )
}
