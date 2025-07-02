import { computed, type MaybeRefOrGetter, toValue } from 'fine-jsx'

import { useEventListener } from 'shared/utils'

import type { ImageSourceInternal } from '../image-source-internal'
import type { MediaEditor } from '../media-editor'

export const SourcePreview = ({
  editor,
  sourceIndex,
  style = '',
  onClick,
}: {
  editor: MaybeRefOrGetter<MediaEditor>
  sourceIndex: MaybeRefOrGetter<number>
  style?: MaybeRefOrGetter<string>
  onClick?: (event: Event) => unknown
}) => {
  const { sources } = toValue(editor)
  const source = computed((): ImageSourceInternal | undefined => sources.value[toValue(sourceIndex)])

  if (onClick != null) useEventListener(() => source.value?.context.canvas, 'click', onClick)

  return (
    <div class={() => ['miru--preview', source.value?.isLoading !== false && 'miru--loading']} style={style}>
      {() => source.value?.context.canvas}
    </div>
  )
}
