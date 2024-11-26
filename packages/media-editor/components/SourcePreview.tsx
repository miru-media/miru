import { computed, type MaybeRefOrGetter, toValue } from 'shared/framework/reactivity'
import { useEventListener } from 'shared/utils'

import { type ImageSourceInternal } from '../ImageSourceInternal'
import { type MediaEditor } from '../MediaEditor'

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

  if (onClick != undefined) useEventListener(() => source.value?.context.canvas, 'click', onClick)

  return (
    <div class={() => ['miru--preview', source.value?.isLoading !== false && 'miru--loading']} style={style}>
      {() => source.value?.context.canvas}
    </div>
  )
}
