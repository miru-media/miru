import { type MaybeRefOrGetter, toValue } from 'fine-jsx'

import { useEventListener } from 'shared/utils'

import styles from '../css/index.module.css'
import type { MediaEditor } from '../media-editor.ts'

export const SourcePreview = ({
  editor,
  style = '',
  onClick,
}: {
  editor: MaybeRefOrGetter<MediaEditor>
  style?: MaybeRefOrGetter<string>
  onClick?: (event: Event) => unknown
}) => {
  const { source } = toValue(editor)

  if (onClick) useEventListener(() => source.value?.context.canvas, 'click', onClick)

  return (
    <div
      class={() => [styles['miru--preview'], source.value?.isLoading !== false && styles['miru--loading']]}
      style={style}
    >
      {() => source.value?.context.canvas}
    </div>
  )
}
