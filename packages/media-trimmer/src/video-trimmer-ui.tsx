import { h, toRef } from 'fine-jsx'
import { computed, effect, type MaybeRefOrGetter, type Ref, ref, toValue } from 'fine-jsx'
import * as Mb from 'mediabunny'

import { Button } from 'shared/components/button.tsx'
import { useElementSize, useEventListener } from 'shared/utils'
import { clamp } from 'shared/utils/math'
import { formatDuration, formatTime, useMediaReadyState } from 'shared/video/utils'

import styles from './media-trimmer.module.css'
import type { LoadInfo, TrimState } from './types/ui.ts'
import { hasRequiredApis } from './utils.ts'

const MIN_CLIP_DURATION_S = 0.25
const MIN_CLIP_WIDTH_PX = 1

const Clip = ({
  range,
  pixelsPerSecond,
  mediaDuration,
  seekTo,
  onResize,
}: {
  range: Ref<{ start: number; end: number }>
  pixelsPerSecond: Ref<number>
  mediaDuration: Ref<number>
  seekTo: (time: number) => void
  onResize: (start: number, end: number, edge: 'left' | 'right') => void
}) => {
  const resizeLeft = ref<HTMLElement>()
  const resizeRight = ref<HTMLElement>()
  const boxEdges = computed(() => {
    const { start, end } = range.value
    const pps = pixelsPerSecond.value
    const left = start * pps
    const right = Math.max(end * pps, left + MIN_CLIP_WIDTH_PX)

    return { left, right }
  })

  const isResizing = ref<'left' | 'right'>()
  const downCoords = { x: 0, y: 0 }
  const initialTime = { start: 0, duration: 0 }

  const onPointerDown = (event: PointerEvent) => {
    if (!!isResizing.value || event.button !== 0) return
    const handle = event.currentTarget as HTMLElement

    downCoords.x = event.pageX
    downCoords.y = event.pageY

    const { start, end } = range.value
    initialTime.start = start
    initialTime.duration = end - start

    handle.setPointerCapture(event.pointerId)
    isResizing.value = handle === resizeLeft.value ? 'left' : 'right'
    event.stopPropagation()
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!isResizing.value) return

    const deltaS = (event.pageX - downCoords.x) / pixelsPerSecond.value

    let newStartTime
    let newDuration
    const { start, end } = range.value

    if (isResizing.value === 'left') {
      newStartTime = clamp(
        initialTime.start + deltaS,
        0,
        initialTime.start + initialTime.duration - MIN_CLIP_DURATION_S,
      )
      newDuration = end - start + (start - newStartTime)
      seekTo(newStartTime)
    } else {
      newStartTime = start
      newDuration = clamp(
        initialTime.duration + deltaS,
        MIN_CLIP_DURATION_S,
        mediaDuration.value - initialTime.start,
      )
      seekTo(newStartTime + newDuration)
    }

    onResize(newStartTime, newStartTime + newDuration, isResizing.value)
  }
  const onLostPointer = () => {
    isResizing.value = undefined
  }

  ;[resizeLeft, resizeRight].forEach((handleRef) => {
    useEventListener(handleRef, 'pointerdown', onPointerDown)
    useEventListener(handleRef, 'pointermove', onPointerMove)
    useEventListener(handleRef, 'lostpointercapture', onLostPointer)
  })

  return (
    <div
      class={[styles.clip, styles.isSelected, styles.canResizeLeft]}
      style={() =>
        `--clip-box-left:${boxEdges.value.left}px;--clip-box-right:${boxEdges.value.right}px;--clip-color:transparent`
      }
    >
      <div class={styles.clipBox}>
        <div class={styles.clipControls}>
          <div ref={resizeLeft} class={styles.clipResizeLeft}>
            <IconTablerChevronLeft />
          </div>
          <div ref={resizeRight} class={styles.clipResizeRight}>
            <IconTablerChevronRight />
          </div>
        </div>
      </div>
    </div>
  )
}

export const VideoTrimmerUI = (props: {
  source: MaybeRefOrGetter<string | Blob | undefined | null>
  state: MaybeRefOrGetter<TrimState>
  onLoad: (info: LoadInfo) => void
  onChange?: (state: TrimState) => void
  onError: (error: unknown) => void
  children?: unknown[]
}) => {
  let url = ''
  const media = document.createElement('video')
  const readyState = useMediaReadyState(media)
  media.playsInline = true
  media.preload = 'auto'

  const timelineContainer = ref<HTMLElement>()
  const isScrubbing = ref(false)
  const containerSize = useElementSize(timelineContainer)
  const pixelsPerSecond = computed(() => containerSize.value.width / mediaDuration.value || 0)
  const isPaused = ref(true)
  const hasAudio = ref(false)
  const stateRef = toRef(props.state)
  const currentTime = ref(0)
  const errorMessage = ref('')
  const unableToDecode = ref(!hasRequiredApis())

  const mediaDuration = ref(0)

  ;['timeupdate', 'seeking'].forEach((type) =>
    useEventListener(media, type, () => (currentTime.value = media.currentTime)),
  )
  ;['play', 'pause'].forEach((type) => useEventListener(media, type, () => (isPaused.value = media.paused)))

  const onScrubberDown = (event: PointerEvent) => {
    if (isScrubbing.value || event.button !== 0) return

    const target = event.currentTarget as HTMLElement

    target.setPointerCapture(event.pointerId)
    isScrubbing.value = true
    onScrubberMove({ offsetX: event.clientX - target.getBoundingClientRect().left })
  }
  const onScrubberMove = ({ offsetX }: { offsetX: number }) => {
    if (!isScrubbing.value) return
    const time = offsetX / pixelsPerSecond.value
    seekTo(time)
  }
  const onScrubberUp = () => (isScrubbing.value = false)

  const seekTo = (time: number) => {
    const { start, end } = stateRef.value
    media.currentTime = currentTime.value = clamp(time, start, end)
  }

  effect(() => {
    const { start, end, mute } = stateRef.value

    media.muted = mute

    const current = currentTime.value

    if (current < start) seekTo(start)
    else if (current >= end) {
      media.pause()
      seekTo(end)
    }
  })

  effect(async (onCleanup) => {
    const source = toValue(props.source)

    media.pause()
    errorMessage.value = ''

    if (source == null || source === '') {
      mediaDuration.value = 0
      return
    }

    const isStringSource = typeof source === 'string'
    url = isStringSource ? source : URL.createObjectURL(source)
    const abort = new AbortController()

    onCleanup(() => {
      abort.abort()
      if (!isStringSource) URL.revokeObjectURL(url)
    })

    const input = new Mb.Input({
      formats: Mb.ALL_FORMATS,
      source: isStringSource
        ? new Mb.UrlSource(source, { requestInit: { signal: abort.signal } })
        : new Mb.BlobSource(source),
    })

    const video = await input.getPrimaryVideoTrack()
    const audio = await input.getPrimaryAudioTrack()

    hasAudio.value = !!audio
    unableToDecode.value = (await Promise.all([video?.canDecode(), audio?.canDecode()])).some(
      (can) => can === false,
    )
    const duration = await input.computeDuration()

    if (abort.signal.aborted) return

    media.src = url
    media.load()
    mediaDuration.value = duration

    const state = stateRef.value

    let start: number
    let end: number

    if (unableToDecode.value) {
      start = 0
      end = duration
    } else {
      start = Math.min(state.start, duration)
      end = state.end !== 0 ? clamp(state.end, state.start, duration) : duration
    }

    props.onLoad({ duration, hasAudio: hasAudio.value })
    props.onChange?.({ start, end, mute: state.mute })
  })

  const onTogglePlayback = () => {
    if (isPaused.value) {
      const { start, end } = stateRef.value
      if (currentTime.value >= end || media.ended) seekTo(start)
      media.play().catch(() => undefined)
    } else media.pause()
  }

  const onToggleMute = () => {
    const { start, end, mute } = stateRef.value
    props.onChange?.({ start, end, mute: !mute })
  }

  const onResize = (start: number, end: number, edge: 'left' | 'right') => {
    props.onChange?.({ start, end, mute: stateRef.value.mute })
    if (edge === 'left') seekTo(start)
    else seekTo(end)
  }

  return (
    <div
      class={styles.videoTrimmer}
      style={() => `--current-time-offset:${currentTime.value * pixelsPerSecond.value}px`}
    >
      <div class={() => [styles.viewport, readyState.value === 0 && styles.isEmpty]}>
        {h(media, { class: styles.viewportCanvas })}
        {() =>
          errorMessage.value && (
            <div class={styles.error} onClick={() => (errorMessage.value = '')}>
              {errorMessage}
            </div>
          )
        }
      </div>
      <div>
        <div class={[styles.controls, styles.numeric]}>
          <div class={[styles.controlsLeft, styles.playPause]}>
            <Button
              disabled={() => mediaDuration.value === 0}
              onClick={onTogglePlayback}
              label={() => (isPaused.value ? 'Play' : 'Pause')}
            >
              {() => (isPaused.value ? <IconTablerPlayerPlay /> : <IconTablerPlayerPause />)}
            </Button>
          </div>
          <div class={styles.controlsCenter}>{() => formatTime(currentTime.value, false)}</div>
          <div class={styles.controlsRight}>
            <div>
              {() => {
                const { start, end } = stateRef.value
                formatDuration(Math.round(end - start))
              }}
            </div>
            {() =>
              unableToDecode.value ? (
                <div></div>
              ) : hasAudio.value ? (
                <Button
                  label={() => (stateRef.value.mute ? 'Include audio' : 'Remove audio')}
                  onClick={onToggleMute}
                >
                  {() => (stateRef.value.mute ? <IconTablerVolumeOff /> : <IconTablerVolume />)}
                </Button>
              ) : (
                <Button disabled onClick={() => undefined}>
                  <IconTablerVolume_3 />
                </Button>
              )
            }
          </div>
        </div>
        <div
          ref={timelineContainer}
          class={styles.timeline}
          onPointerDown={onScrubberDown}
          onPointerMove={onScrubberMove}
          onLostPointerCapture={onScrubberUp}
        >
          {() =>
            unableToDecode.value ? (
              <>
                <div class={styles.clip}>
                  <div class={styles.clipWarning}>Editing this video format isn't supported</div>
                </div>
                <div class={styles.cursor} />
              </>
            ) : mediaDuration.value ? (
              <>
                <Clip
                  range={stateRef}
                  mediaDuration={mediaDuration}
                  pixelsPerSecond={pixelsPerSecond}
                  seekTo={seekTo}
                  onResize={onResize}
                />
                <div class={styles.cursor} />
              </>
            ) : (
              <div class={styles.clip} />
            )
          }
        </div>
      </div>
      {props.children}
    </div>
  )
}
