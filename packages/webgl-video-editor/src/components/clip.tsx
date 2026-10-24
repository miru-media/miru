import '@interactjs/actions/resize'
import '@interactjs/actions/drag'
import '@interactjs/modifiers'
import '@interactjs/auto-start'
import type easingsFunctions from 'easings.net'
import { computed, ref } from 'fine-jsx'

import { CLIP_COLORS } from '#constants'
import type { AnyClip } from '#core'
import { stringHashCode, useI18n } from 'shared/utils'

import styles from '../css/index.module.css'
import type { VideoEditor } from '../video-editor.ts'

import { nodesAreLinked, useTrackChildEdges } from './utils.ts'

const GAPPED = true as boolean
const EASING_ENTRIES = [
  ['linear', '0, 0, 1, 1'],
  ['easeInQuad', '0.11, 0, 0.5, 0'],
  ['easeOutQuad', '0.5, 1, 0.89, 1'],
  ['easeInOutQuad', '0.45, 0, 0.55, 1'],
  ['easeInSine', '0.12, 0, 0.39, 0'],
  ['easeOutSine', '0.61, 1, 0.88, 1'],
  ['easeInOutSine', '0.37, 0, 0.63, 1'],
  ['easeInCubic', '0.32, 0, 0.67, 0'],
  ['easeOutCubic', '0.33, 1, 0.68, 1'],
  ['easeInOutCubic', '0.65, 0, 0.35, 1'],
  ['easeInQuart', '0.5, 0, 0.75, 0'],
  ['easeOutQuart', '0.25, 1, 0.5, 1'],
  ['easeInOutQuart', '0.76, 0, 0.24, 1'],
  ['easeInQuint', '0.64, 0, 0.78, 0'],
  ['easeOutQuint', '0.22, 1, 0.36, 1'],
  ['easeInOutQuint', '0.83, 0, 0.17, 1'],
  ['easeInExpo', '0.7, 0, 0.84, 0'],
  ['easeOutExpo', '0.16, 1, 0.3, 1'],
  ['easeInOutExpo', '0.87, 0, 0.13, 1'],
  ['easeInCirc', '0.55, 0, 1, 0.45'],
  ['easeOutCirc', '0, 0.55, 0.45, 1'],
  ['easeInOutCirc', '0.85, 0, 0.15, 1'],
  ['easeInBack', '0.36, 0, 0.66, -0.56'],
  ['easeOutBack', '0.34, 1.56, 0.64, 1'],
  ['easeInOutBack', '0.68, -0.6, 0.32, 1.6'],
] satisfies [keyof typeof easingsFunctions, string][]

const CLIP_ICONS = {
  'clip:video': undefined,
  'clip:audio': IconMsMusicNoteRounded,
  'clip:image': IconMsPhotoOutlineRounded,
  'clip:text': IconMsTextFieldsRounded,
} satisfies Record<AnyClip['type'], ((props: { class: unknown }) => JSX.Element) | undefined>

const ANIMATION_UI_PREFIX = 'clip-animation:'

const KEYFRAME_GROUPS = [
  { id: 'scale', keys: ['scaleX', 'scaleY'] },
  { id: 'translate', keys: ['translateX', 'translateY'] },
] as const

export const Clip = ({
  node: clip,
  editor,
  isSelected,
}: {
  node: AnyClip
  editor: VideoEditor
  isSelected: () => boolean
}) => {
  const { t } = useI18n()
  const mainContainer = ref<HTMLElement>()

  const clipColor = computed(
    () =>
      clip.color ??
      clip.asset?.color ??
      CLIP_COLORS[Math.abs(stringHashCode(clip.asset?.id ?? clip.id)) % CLIP_COLORS.length],
  )

  const boxEdges = useTrackChildEdges(editor, clip)

  const selectClip = () => editor.select(clip, false)
  const selectGap = (event: Event): void => {
    editor.select({ node: clip, isNode: false }, false)
    event.stopPropagation()
  }

  const isVideoMedia = () => (clip.isVideo() && clip.isMediaClip()) || clip.isImageClip()
  const getIcon = () =>
    clip.isAudio() ? IconMsMusicNoteRounded : clip.isTextClip() ? IconMsTextFieldsRounded : undefined

  const animationUi = ref(sessionStorage.getItem(ANIMATION_UI_PREFIX + clip.id) ?? '')
  const toggleAnimationUi = (key: string): void => {
    sessionStorage.setItem(
      ANIMATION_UI_PREFIX + clip.id,
      (animationUi.value = animationUi.value === key ? '' : key),
    )
  }

  return (
    <div
      data-clip-id={clip.id}
      style={() => `
        --clip-box-left: ${boxEdges.value.left}px;
        --clip-box-right: ${boxEdges.value.right}px;
        --clip-color: ${clipColor.value};
        ${isVideoMedia() && clip.asset?.thumbnailUri ? `--clip-thumbnail: url("${encodeURI(clip.asset.thumbnailUri)}");` : ''}
      `}
      onClick={selectClip}
    >
      <div
        tabindex="0"
        onClick={selectGap}
        onFocus={selectGap}
        hidden={() => clip.gap.value <= 0}
        class={() => [
          styles.clipGap,
          editor.selection?.isNode === false &&
            nodesAreLinked(editor.selection.node, clip) &&
            styles.isSelected,
        ]}
        style={() => `
        --clip-box-left: ${editor.secondsToPixels(clip.prev?.time.end ?? 0)}px;
        --clip-box-right: ${editor.secondsToPixels(clip.time.start)}px;`}
      >
        {() => editor._showStats && <div class="text-right">{clip.gap.valueOf().toFixed(2)}</div>}
      </div>

      <div
        data-interactive-clip-id={clip.id}
        tabindex="0"
        class={() => [
          styles.clip,
          isVideoMedia() && styles.isVideoMedia,
          isSelected() && [styles.isSelected, editor.drag.isActive() && styles.isDragging],
          clip.isMediaClip() && !editor.playback._getNode(clip)?.everHadEnoughData && styles.isLoading,
          (GAPPED || clip.prev) && styles.canResizeLeft,
          clip.next &&
            editor.selection?.isNode &&
            editor.selection.id === clip.next.id &&
            styles.nextIsSelected,
        ]}
        onFocus={selectClip}
      >
        <div ref={mainContainer} class={styles.clipBox}>
          {() => {
            const Icon = CLIP_ICONS[clip.type]
            return Icon && <Icon class={[styles.clipIcon, styles.first]} />
          }}
          {() =>
            !clip.asset?.thumbnailUri && (
              <span class={[styles.clipName, !getIcon() && styles.first]}>
                {() =>
                  clip.name || (clip.isTextClip() ? clip.content : ((clip.name || clip.asset?.name) ?? ''))
                }
              </span>
            )
          }
        </div>
        <div class={styles.clipControls}>
          <div class={styles.clipResizeLeft}></div>
          <div class={styles.clipResizeRight}></div>
        </div>
        {() =>
          Array.from(clip.animationMap.values()).map((animation) =>
            animation.keyframes.map((keyframe) => (
              <IconMsSquareRounded
                class={styles.clipKeyframe}
                style={() =>
                  `translate: calc(var(--clip-box-left) + ${editor.secondsToPixels(keyframe.time.valueOf())}px)`
                }
                onClick={() => editor.seekTo(clip.time.start + keyframe.time.valueOf())}
              />
            )),
          )
        }
      </div>

      <div class={styles.clipBelow}>
        {() =>
          editor._showStats && (
            <pre
              style="position:relative;margin:0;left:var(--clip-box-left);font-size:0.625rem;line-height:1"
              data-id={clip.id}
            >
              {clip.toJSON()}
            </pre>
          )
        }
        {() => {
          const completeGroupedKeys = new Set<string>()
          const completeGroups = KEYFRAME_GROUPS.slice(0, 0)

          KEYFRAME_GROUPS.forEach((group) => {
            if (group.keys.every((key) => clip.animationMap.get(key)?.keyframes.length ?? 0)) {
              completeGroups.push(group)
              group.keys.forEach((key) => void completeGroupedKeys.add(key))
            }
          })

          const grouped = completeGroups.map((group) => ({
            label: group.id,
            keyframes: group.keys.flatMap((key) => clip.animationMap.get(key)!.keyframes),
          }))
          const ungrouped = Array.from(clip.animationMap)
            .filter(([key]) => !completeGroupedKeys.has(key))
            .map(([key, { keyframes }]) => ({
              label: key,
              keyframes,
            }))

          return [...grouped, ...ungrouped].map(
            ({ label, keyframes }) =>
              keyframes.length > 0 && (
                <div class={() => [styles.clipAnimation, animationUi.value === label && styles.open]}>
                  <button onClick={() => toggleAnimationUi(label)} class={styles.clipAnimationToggle}>
                    <svg class={styles.clipAnimationExpandIcon} width="4" height="7" viewBox="0 0 4 7">
                      <path d="M0.428711 0.428467L3.42871 3.42847L0.428711 6.42847" />
                    </svg>

                    {t(`prop_${label}`)}
                  </button>

                  {() =>
                    animationUi.value === label && (
                      <menu class={styles.clipAnimationCurves}>
                        {EASING_ENTRIES.map(([id, points]) => (
                          <li>
                            <button
                              class={styles.clipAnimationCurve}
                              ariaSelected={() => keyframes.every((k) => k.easing === id)}
                              onClick={() => {
                                keyframes.forEach((k) => void (k.easing = id))
                                editor.seekTo(clip.time.start)
                                editor.play()
                              }}
                            >
                              <svg viewBox="0 0 1 1">
                                <path d={`M 0 0 C ${points} 1 1`} />
                              </svg>
                              {t(id)}
                            </button>
                          </li>
                        ))}
                      </menu>
                    )
                  }
                </div>
              ),
          )
        }}
      </div>
    </div>
  )
}
