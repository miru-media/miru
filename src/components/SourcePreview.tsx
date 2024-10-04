import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { MaybeRefOrGetter, computed, toValue } from '@/framework/reactivity'
import { useEventListener } from '@/utils'

export const SourcePreview = ({
  engine,
  sourceIndex,
  style,
  onClick,
}: {
  engine: MaybeRefOrGetter<ImageEditorEngine>
  sourceIndex: MaybeRefOrGetter<number>
  style?: MaybeRefOrGetter<string>
  onClick?: (event: Event) => unknown
}) => {
  const { sources } = toValue(engine)
  const source = computed(() => sources.value[toValue(sourceIndex)])

  if (onClick) useEventListener(() => source.value?.context.canvas, 'click', onClick)

  return (
    <div class="miru--preview" style={style}>
      {source.value?.context.canvas}
    </div>
  )
}
