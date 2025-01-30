import { type MaybeRefOrGetter, toValue } from 'fine-jsx'

export const LoadingOverlay = ({ loading }: { loading?: MaybeRefOrGetter<boolean> }) => {
  return (
    <div class={['loading-overlay', () => (toValue(loading) ?? true) && 'loading']}>
      <IconTablerLoader2 />
    </div>
  )
}
