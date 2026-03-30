import { type MaybeRefOrGetter, ref, toValue } from 'fine-jsx'

import styles from '../css/shared.module.css'

export const LoadingOverlay = ({ loading }: { loading?: MaybeRefOrGetter<boolean> }) => {
  const value = ref('')
  return (
    <div class={[styles.loadingOverlay, () => (toValue(loading) ?? true) && styles.loading]}>
      <input value={value.value}></input>
      <IconTablerLoader2 />
    </div>
  )
}
