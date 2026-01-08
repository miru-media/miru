import { type MaybeRefOrGetter, toValue } from 'fine-jsx'

import styles from '../css/shared.module.css'

export const LoadingOverlay = ({ loading }: { loading?: MaybeRefOrGetter<boolean> }) => (
  <div class={[styles.loadingOverlay, () => (toValue(loading) ?? true) && styles.loading]}>
    <IconTablerLoader2 />
  </div>
)
