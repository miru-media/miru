import { ImageEditor } from '@/editor/ImageEditor'
import { ImageSourceInternal } from '@/editor/ImageSourceInternal'
import { computed, MaybeRefOrGetter, toValue } from '@/framework/reactivity'
import { useEventListener } from '@/utils'

export const SourcePreview = ({
  editor,
  sourceIndex,
  style = '',
  onClick,
}: {
  editor: MaybeRefOrGetter<ImageEditor>
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
