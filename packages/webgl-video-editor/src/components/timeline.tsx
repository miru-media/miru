import '@interactjs/actions/gesture'
import type { GestureEvent } from '@interactjs/actions/gesture/plugin'
import interact from '@interactjs/interact'
import { computed, effect, type MaybeChild, type MaybeRefOrGetter, ref, toValue } from 'fine-jsx'

import type { InputEvent } from 'shared/types'
import { useElementSize, useI18n } from 'shared/utils'
import { useScrubber } from 'shared/video/use-scrubber.ts'

import { ACCEPT_VIDEO_FILE_TYPES } from '../constants.ts'
import styles from '../css/index.module.css'

import { Playhead } from './playhead.jsx'
import { Ruler } from './ruler.jsx'
import { Track } from './track.jsx'
import { useEditor } from './utils.ts'

const TIMELINE_OFFSET_DESKTOP_PX = 24
const WHEEL_ZOOM_DELTA_MODE_SCALE: Record<number, number> = {
  0: 20,
  1: 80,
  2: 500,
}
const WHEEL_SCROLL_LINE = 20
const WHEEL_SCROLL_PAGE = 200

export const Timeline = ({
  children,
}: {
  children?: { empty?: MaybeRefOrGetter<MaybeChild>; tracks?: MaybeRefOrGetter<MaybeChild> }
}): JSX.Element => {
  const editor = useEditor()
  const { t } = useI18n()
  const scrollContainer = ref<HTMLElement>()
  const scrollOffset = ref(0)
  const scrollContainerSize = useElementSize(scrollContainer)
  const timelineOffset = computed(() =>
    editor.isMobileWorkspace ? scrollContainerSize.value.width / 2 : TIMELINE_OFFSET_DESKTOP_PX,
  )
  const { doc } = editor

  const timelineSize = editor._timelineSize

  const scrubberContext = {
    pixelsPerSecond: () => 1 / editor.timelineZoom.secondsPerPixel,
    currentTime: () => editor.currentTime,
    mediaDuration: () => editor.doc.duration,
    offsetX: () => timelineOffset.value - scrollOffset.value,
    seekTo: editor.seekTo.bind(editor),
  }

  useScrubber(
    scrubberContext,
    () => (editor.isMobileWorkspace ? undefined : scrollContainer.value),
    undefined,
    (event) =>
      event.target === event.currentTarget || !(event.target as HTMLElement).closest('[data-clip-id'),
  )

  const scrollIsClose = (): boolean =>
    Math.abs(scrollOffset.value - (scrollContainer.value?.scrollLeft ?? 0)) <
    editor.secondsToPixels(5 / doc.frameRate)

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

  const changeSpp = (newValue: number): void => {
    const scroller = scrollContainer.value
    const prevScrollTime = editor.pixelsToSeconds(scroller?.scrollLeft ?? 0)
    editor.timelineZoom.secondsPerPixel = newValue

    if (scroller) {
      scrollOffset.value = scroller.scrollLeft = editor.secondsToPixels(prevScrollTime)
    }
  }

  const onWheel = (event: WheelEvent): void => {
    const { deltaMode, deltaY } = event
    const scroller = scrollContainer.value
    if (!scroller) return

    if (event.ctrlKey) {
      changeSpp(
        editor.timelineZoom.secondsPerPixel +
          editor.pixelsToSeconds(deltaY) / WHEEL_ZOOM_DELTA_MODE_SCALE[deltaMode],
      )
    } else {
      if (deltaMode === 0) return

      const scale = deltaMode === 1 ? WHEEL_SCROLL_LINE : WHEEL_SCROLL_PAGE
      let dx = event.deltaX * scale
      let dy = deltaY * scale

      if (event.shiftKey) [dx, dy] = [dy, dx]
      scroller.scrollLeft += dy
      scrollOffset.value = scroller.scrollLeft
      scroller.scrollTop += dx
    }

    event.preventDefault()
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

  const onPointerdownScroller = (event: Event): void => {
    if (!(event.target as HTMLElement).closest(`.${styles.clipBoxBase}`)) editor.select(undefined)
  }

  effect((onCleanup) => {
    const gestureElement = scrollContainer.value
    if (!gestureElement) return

    const interactable = interact(gestureElement, {
      gesture: {
        listeners: {
          move: (event: GestureEvent) => changeSpp(editor.timelineZoom.secondsPerPixel / (1 + event.ds)),
        },
      },
    })

    onCleanup(interactable.unset.bind(interactable))
  })

  return (
    <div
      class={styles.timeline}
      style={() => `
          --timeline-width: ${timelineSize.value.width}px;
          --timeline-height: ${timelineSize.value.height}px;
          --timeline-padding-left: ${timelineOffset.value}px;
          --timeline-duration:${editor.secondsToPixels(Math.max(editor.resize.docDuration.value, doc.duration))}px;
          --timeline-current-time:${editor.secondsToPixels(editor.currentTime)}px;
          --clip-drag-offset-y: ${editor.drag._offsetY.value}px;`}
    >
      <div
        ref={scrollContainer}
        class={styles.timelineScroller}
        onScroll={onScroll}
        onPointerdown={onPointerdownScroller}
        onWheel={onWheel}
      >
        <Ruler {...{ scrollOffset, timelineOffset }} />

        <div class={styles.trackList} ref={editor._timelineContainer}>
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

        {() => !editor.isMobileWorkspace && <Playhead />}
      </div>

      {() => editor.isMobileWorkspace && <Playhead />}
    </div>
  )
}
