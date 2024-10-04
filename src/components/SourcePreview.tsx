import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import { MaybeRefOrGetter, computed, toValue } from '@/framework/reactivity'
import { useEventListener } from '@/utils'

export const SourcePreview = ({
  engine,
  sourceIndex,
  style,
}: {
  engine: MaybeRefOrGetter<ImageEditorEngine>
  sourceIndex: MaybeRefOrGetter<number>
  style?: MaybeRefOrGetter<string>
}) => {
  const { sources, currentSourceIndex } = toValue(engine)
  const source = computed(() => sources.value[toValue(sourceIndex)])

  useEventListener(
    () => source.value?.context.canvas,
    'click',
    () => (currentSourceIndex.value = toValue(sourceIndex)),
  )

  return (
    <div class="miru--preview" style={style}>
      {source.value?.context.canvas}
    </div>
  )
}
