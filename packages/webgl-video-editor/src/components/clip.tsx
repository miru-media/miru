import '@interactjs/actions/resize'
import '@interactjs/actions/drag'
import '@interactjs/modifiers'
import '@interactjs/auto-start'
import { computed, ref } from 'fine-jsx'

import type { AnyClip } from '#core'
import { stringHashCode } from 'shared/utils'

import { CLIP_COLORS } from '../constants.ts'
import styles from '../css/index.module.css'
import type { VideoEditor } from '../video-editor.ts'

import { useTrackChildEdges } from './utils.ts'

const DISABLED_COLOR = 'var(--white-2)'
const GAPPED = true as boolean

export const Clip = ({
  node: clip,
  editor,
  isSelected,
}: {
  node: AnyClip
  editor: VideoEditor
  isSelected: () => boolean
}) => {
  const mainContainer = ref<HTMLElement>()

  const clipColor = computed(() =>
    (editor.playback._getNode(clip)?.everHadEnoughData ?? true)
      ? (clip.color ??
        clip.asset?.color ??
        CLIP_COLORS[Math.abs(stringHashCode(clip.asset?.id ?? clip.id)) % CLIP_COLORS.length])
      : DISABLED_COLOR,
  )

  const boxEdges = useTrackChildEdges(editor, clip)

  const selectClip = editor.select.bind(editor, clip, false)
  const selectGap = (): void => editor.select({ node: clip, isNode: false }, false)

  const isVideoMedia = () => clip.isVideo() && clip.isMediaClip()
  const Icon = clip.isAudio()
    ? IconMsMusicNoteRounded
    : clip.isTextClip()
      ? IconMsTextFieldsRounded
      : undefined

  return (
    <>
      <div
        tabindex="0"
        onClick={selectGap}
        onFocus={selectGap}
        hidden={() => clip.gap.value <= 0}
        class={() => [
          styles.clipGap,
          editor.selection?.isNode === false && editor.selection.node.id === clip.id && styles.isSelected,
        ]}
        style={() => `
        --clip-box-left: ${editor.secondsToPixels(clip.prev?.time.end ?? 0)}px;
        --clip-box-right: ${editor.secondsToPixels(clip.time.start)}px;`}
      >
        {() => editor._showStats && <div class="text-right">{clip.gap.valueOf().toFixed(2)}</div>}
      </div>

      <div
        tabindex="0"
        class={() => [
          styles.clip,
          isVideoMedia() && styles.isVideoMedia,
          isSelected() && [styles.isSelected, editor.drag.isDragging() && styles.isDragging],
          (GAPPED || clip.prev) && styles.canResizeLeft,
          clip.next &&
            editor.selection?.isNode &&
            editor.selection.id === clip.next.id &&
            styles.nextIsSelected,
        ]}
        style={() => `
        --clip-box-left: ${boxEdges.value.left}px;
        --clip-box-right: ${boxEdges.value.right}px;
        --clip-color: ${clipColor.value};
        ${isVideoMedia() && clip.asset?.thumbnailUri ? `--clip-thumbnail: url("${encodeURI(clip.asset.thumbnailUri)}");` : ''}
      `}
        onFocus={selectClip}
        onClick={selectClip}
      >
        <div ref={mainContainer} data-clip-id={clip.id} class={styles.clipBox}>
          {() =>
            editor._showStats && (
              <pre class="z-1 bg-#0004 pointer-events-node line-height-1em">
                …{clip.id.slice(clip.id.length / 2)}
              </pre>
            )
          }
          {Icon !== undefined && <Icon class={styles.clipIcon} />}
          <span class={styles.clipName}>
            {() => clip.name || (clip.isTextClip() ? clip.content : (clip.asset?.name ?? ''))}
          </span>
          <div class={styles.clipControls}>
            <div class={styles.clipResizeLeft}>
              <IconTablerChevronLeft />
            </div>
            <div class={styles.clipResizeRight}>
              <IconTablerChevronRight />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
