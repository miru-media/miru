import '@interactjs/actions/drop'
import { effect, type MaybeChild, type MaybeRefOrGetter, ref, toValue } from 'fine-jsx'

import type * as pub from '#core'
import type { InputEvent } from 'shared/types'
import { useI18n } from 'shared/utils'

import { ACCEPT_VIDEO_FILE_TYPES } from '../constants.ts'
import styles from '../css/index.module.css'

import { Playhead } from './playhead.jsx'
import { Ruler } from './ruler.jsx'
import { Track } from './track.jsx'
import { useEditor } from './utils.ts'

export const Timeline = ({
  children,
}: {
  children?: { empty?: MaybeRefOrGetter<MaybeChild>; tracks?: MaybeRefOrGetter<MaybeChild> }
}): JSX.Element => {
  const editor = useEditor()
  const { t } = useI18n()
  const scrollContainer = ref<HTMLElement>()
  const { doc } = editor

  const timelineSize = editor._timelineSize

  let lastScroll = 0
  const scrollIsClose = (): boolean => Math.abs(lastScroll - (scrollContainer.value?.scrollLeft ?? 0)) < 1

  effect(() => {
    const scrollEl = scrollContainer.value
    const newScroll = editor.secondsToPixels(doc.currentTime)
    if (!scrollEl || lastScroll === newScroll) return

    scrollEl.scrollLeft = newScroll
    lastScroll = scrollEl.scrollLeft
  })

  const onScroll = () => {
    const scrollEl = scrollContainer.value
    if (!scrollEl || scrollIsClose()) return

    editor.seekTo(editor.pixelsToSeconds((lastScroll = scrollEl.scrollLeft)))
  }

  const onInputClipFile = async (event: InputEvent, track: pub.Track | undefined) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      editor.addClip(track ?? editor.addTrack('video'), await editor.createMediaAsset(file))
    } catch {
      // eslint-disable-next-line no-alert -- TODO
      alert(t('error_cannot_play_type'))
    }
  }

  const onPointerdownScroller = (event: Event) => {
    if (!(event.target as HTMLElement).closest(`.${styles.clip}`)) editor.select(undefined)
  }

  const dragTargetTrack = editor.drag.targetTrack

  return (
    <div
      ref={editor._timelineContainer}
      class={styles.timeline}
      style={() => `
          --editor-width: ${timelineSize.value.width}px;
          --editor-height: ${timelineSize.value.height}px;
          --timeline-width:${editor.secondsToPixels(Math.max(editor.resize.docDuration.value, doc.duration))}px`}
    >
      <Playhead />

      <div
        ref={scrollContainer}
        class={styles.timelineScroller}
        onScroll={onScroll}
        onPointerdown={onPointerdownScroller}
      >
        <Ruler />

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
                      onInput={(event: InputEvent) => onInputClipFile(event, doc.timeline.head)}
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
                      dragTargetTrack.value?.id === track.id && dragTargetTrack.value.before && styles.active,
                    ]}
                  />
                  <Track data-track-id={track.id} track={track} onInputClipFile={onInputClipFile} />
                </>
              ))
            )
          }
        </div>
      </div>
    </div>
  )
}
