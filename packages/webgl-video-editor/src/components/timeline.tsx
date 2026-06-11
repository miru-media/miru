import { computed, effect, type MaybeChild, type MaybeRefOrGetter, ref, toValue } from 'fine-jsx'

import type { InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils'

import { ACCEPT_VIDEO_FILE_TYPES } from '../constants.ts'
import styles from '../css/index.module.css'

import { Playhead } from './playhead.jsx'
import { Ruler } from './ruler.jsx'
import { Track } from './track.jsx'
import { useEditor } from './utils.ts'

const TIMELINE_OFFSET_DESKTOP_PX = 24

export const Timeline = ({
  children,
}: {
  children?: { empty?: MaybeRefOrGetter<MaybeChild>; tracks?: MaybeRefOrGetter<MaybeChild> }
}): JSX.Element => {
  const editor = useEditor()
  const { t } = useI18n()
  const scrollContainer = ref<HTMLElement>()
  const scrollOffset = ref(0)
  const timelineOffset = computed(() =>
    editor.isMobileWorkspace ? editor._timelineSize.value.width / 2 : TIMELINE_OFFSET_DESKTOP_PX,
  )
  const { doc } = editor

  const timelineSize = editor._timelineSize

  const scrollIsClose = (): boolean =>
    Math.abs(scrollOffset.value - (scrollContainer.value?.scrollLeft ?? 0)) < 1

  effect(() => {
    if (!editor.isMobileWorkspace) {
      scrollOffset.value = scrollContainer.value?.scrollLeft ?? 0
      return
    }

    const scrollEl = scrollContainer.value
    const newScroll = editor.secondsToPixels(doc.currentTime)
    if (!scrollEl || scrollOffset.value === newScroll) return

    scrollEl.scrollLeft = newScroll
    scrollOffset.value = scrollEl.scrollLeft
  })

  const onScroll = (): void => {
    if (!editor.isMobileWorkspace) {
      scrollOffset.value = scrollContainer.value?.scrollLeft ?? 0
      return
    }

    const scrollEl = scrollContainer.value
    if (!scrollEl || scrollIsClose()) return

    editor.seekTo(editor.pixelsToSeconds((scrollOffset.value = scrollEl.scrollLeft)))
  }

  const onInputClipFile = async (event: InputEvent) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const asset = await editor.createMediaAsset(file)
      editor.addClip(editor.getTrackForMedia(asset), asset)
    } catch {
      // eslint-disable-next-line no-alert -- TODO
      alert(t('error_cannot_play_type'))
    }
  }

  const onPointerdownScroller = (event: Event) => {
    if (!(event.target as HTMLElement).closest(`.${styles.clipBoxBase}`)) editor.select(undefined)
  }

  return (
    <div
      ref={editor._timelineContainer}
      class={styles.timeline}
      style={() => `
          --timeline-width: ${timelineSize.value.width}px;
          --timeline-height: ${timelineSize.value.height}px;
          --timeline-offset: ${timelineOffset.value}px;
          --timeline-duration:${editor.secondsToPixels(Math.max(editor.resize.docDuration.value, doc.duration))}px;
          --timeline-current-time:${editor.secondsToPixels(editor.currentTime)}px`}
    >
      {() => editor.isMobileWorkspace && <Playhead />}

      <div
        ref={scrollContainer}
        class={styles.timelineScroller}
        onScroll={onScroll}
        onPointerdown={onPointerdownScroller}
      >
        <Ruler {...{ scrollOffset, timelineOffset }} />

        {() => !editor.isMobileWorkspace && <Playhead />}

        <div class={styles.trackList}>
          {() =>
            doc.isEmpty ? (
              <>
                <div class={styles.track}>
                  <label class={[styles.button, styles.trackButton]}>
                    <input
                      type="file"
                      class={styles.srOnly}
                      accept={ACCEPT_VIDEO_FILE_TYPES}
                      onInput={(event: InputEvent) => onInputClipFile(event)}
                    />
                    <span class={styles.textBody}>{t('click_add_clip')}</span>
                  </label>
                </div>
                <div class={styles.track}>
                  <div class={styles.slot}>{toValue(children?.empty)}</div>
                </div>
              </>
            ) : (
              doc.timeline.children.map((track) => (
                <>
                  <div
                    data-before-track-id={track.id}
                    class={() => [
                      styles.clipDragTrackSpace,
                      editor.drag.targetTrack?.id === track.id &&
                        editor.drag.targetTrack.before &&
                        styles.active,
                    ]}
                  />
                  <Track data-track-id={track.id} track={track} />
                </>
              ))
            )
          }
        </div>
      </div>
    </div>
  )
}
