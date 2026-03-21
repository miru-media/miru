import '@interactjs/actions/resize'
import '@interactjs/actions/drag'
import '@interactjs/modifiers'
import '@interactjs/auto-start'
import { computed, ref } from 'fine-jsx'

import { Button } from 'shared/components/button.tsx'
import { stringHashCode, useI18n } from 'shared/utils'

import type { AnyClip } from '../../types/core.d.ts'
import { CLIP_COLORS, MIN_CLIP_WIDTH_PX } from '../constants.ts'
import styles from '../css/index.module.css'
import type { VideoEditor } from '../video-editor.ts'

const DISABLED_COLOR = 'var(--white-2)'

export const Clip = ({
  clip,
  editor,
  isSelected,
}: {
  clip: AnyClip
  editor: VideoEditor
  isSelected: () => boolean
}) => {
  const { t, tr } = useI18n()
  const mainContainer = ref<HTMLElement>()

  const clipColor = computed(() =>
    editor.playback._getNode(clip).everHadEnoughData
      ? (clip.color ??
        clip.asset?.color ??
        CLIP_COLORS[Math.abs(stringHashCode(clip.asset?.id ?? '')) % CLIP_COLORS.length])
      : DISABLED_COLOR,
  )

  const boxEdges = computed(() => {
    const { time } = clip
    const { isDragging, x } = editor.drag

    const left = isSelected() && isDragging.value ? x.value : editor.secondsToPixels(time.start)
    const right = left + Math.max(MIN_CLIP_WIDTH_PX, editor.secondsToPixels(time.duration))

    return { left, right }
  })

  return (
    <div
      class={() => [
        styles.clip,
        isSelected() && [styles.isSelected, editor.drag.isDragging.value && styles.isDragging],
        clip.prev && styles.canResizeLeft,
        clip.next && editor.selection === clip.next && styles.nextIsSelected,
      ]}
      style={() => `
        --clip-box-left: ${boxEdges.value.left}px;
        --clip-box-right: ${boxEdges.value.right}px;
        --drag-offset: ${editor.drag.x.value};
        --clip-color: ${clipColor.value};
      `}
    >
      <div
        ref={mainContainer}
        data-clip-id={clip.id}
        class={styles.clipBox}
        onClick={() => editor.select(clip, false)}
      >
        <span class={styles.clipName}>{clip.name || (clip.asset?.name ?? '')}</span>
        <div class={styles.clipControls}>
          <div class={styles.clipResizeLeft}>
            <IconTablerChevronLeft />
          </div>
          <div class={styles.clipResizeRight}>
            <IconTablerChevronRight />
          </div>
        </div>
      </div>
      {import.meta.env.DEV && (
        <Button
          class={styles.clipTransition}
          label={tr('transition')}
          onClick={() => {
            // eslint-disable-next-line no-alert -- TODO
            alert(t('Not implemented.'))
          }}
        >
          {() => (clip.transition ? <IconTablerChevronsRight /> : <IconTablerChevronRight />)}
        </Button>
      )}
    </div>
  )
}
