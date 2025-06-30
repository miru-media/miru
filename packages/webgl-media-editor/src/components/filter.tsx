import { computed, type MaybeRefOrGetter, ref, toValue, watch } from 'fine-jsx'

import { Effect } from 'reactive-effects/effect'

import { type ImageSourceInternal } from '../image-source-internal'
import { type MediaEditor } from '../media-editor'

import { SourcePreview } from './source-preview'
import { WebglEffectsMenu, type WebglEffectsMenuExpose } from './webgl-effects-menu'

export const FilterView = ({
  editor,
  sourceIndex,
  showPreviews,
  showIntensity,
  onChange,
}: {
  editor: MediaEditor
  sourceIndex: MaybeRefOrGetter<number>
  showPreviews?: MaybeRefOrGetter<boolean | undefined>
  showIntensity?: MaybeRefOrGetter<boolean | undefined>
  onChange?: (effectId: string | undefined, intensity: number) => void
}) => {
  const source = computed((): ImageSourceInternal | undefined => editor.sources.value[toValue(sourceIndex)])
  const menu = ref<WebglEffectsMenuExpose>()

  // scroll to selected filter on source change
  watch([source], ([source]) => {
    if (source) menu.value?.scrollToEffect(source.effect.value, 'instant')
  })

  const adjustmentEffect = new Effect(
    { name: '_', ops: [{ type: 'adjust_color', brightness: 0, contrast: 0, saturation: 0 }] },
    editor.renderer,
  )

  const EMPTY_SIZE = { width: 1, height: 1 }
  const getAdjustmentOps = () => {
    const adjustments = source.value?.adjustments
    if (!adjustments) return []

    const op = adjustmentEffect.ops[0]
    Object.assign(op.uniforms, adjustments)

    return [op]
  }

  return (
    <>
      {() =>
        toValue(showPreviews) === true &&
        editor.sources.value.map((_source, index) => <SourcePreview editor={editor} sourceIndex={index} />)
      }
      <WebglEffectsMenu
        sourceTexture={() => source.value?.texture}
        sourceSize={() => source.value?.rotated ?? EMPTY_SIZE}
        thumbnailSize={() => source.value?.thunmbnailSize ?? EMPTY_SIZE}
        crop={() => source.value?.crop.value}
        renderer={editor.renderer}
        effects={editor.effects}
        effect={() => source.value?.effect.value}
        intensity={() => source.value?.intensity.value ?? 1}
        prependOps={getAdjustmentOps}
        showIntensity={showIntensity}
        onChange={(id, intensity) => {
          const $source = source.value
          if (!$source) return
          $source.effect.value = id
          $source.intensity.value = intensity
          onChange?.(id, intensity)
        }}
      />
      {/* spacer */}
      <div />
    </>
  )
}
