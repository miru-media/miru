import { h } from 'fine-jsx'
import { computed, effect, type MaybeRefOrGetter, type Ref, ref, toValue } from 'fine-jsx'

import { IconButton } from 'shared/components/icon-button'
import { ToggleButton } from 'shared/components/toggle-button'
import { useElementSize, useEventListener } from 'shared/utils'
import { clamp } from 'shared/utils/math'
import {
  formatDuration,
  formatTime,
  getContainerMetadata,
  getMediaElementInfo,
  useMediaReadyState,
} from 'shared/video/utils'

import { type LoadInfo, type TrimState } from './types/ui'
import { hasRequiredApis } from './utils'

const MIN_CLIP_DURATION_S = 0.25
const MIN_CLIP_WIDTH_PX = 1

const Clip = ({
  startTime,
  endTime,
  pixelsPerSecond,
  mediaDuration,
  seekTo,
  onResize,
}: {
  startTime: Ref<number>
  endTime: Ref<number>
  pixelsPerSecond: Ref<number>
  mediaDuration: Ref<number>
  seekTo: (time: number) => void
  onResize: (start: number, end: number, edge: 'left' | 'right') => void
}) => {
  const resizeLeft = ref<HTMLElement>()
  const resizeRight = ref<HTMLElement>()
  const boxEdges = computed(() => {
    const pps = pixelsPerSecond.value
    const left = startTime.value * pps
    const right = Math.max(endTime.value * pps, left + MIN_CLIP_WIDTH_PX)

    return { left, right }
  })

  const isResizing = ref<'left' | 'right'>()
  const downCoords = { x: 0, y: 0 }
  const initialTime = { start: 0, duration: 0 }

  const onPointerDown = (event: PointerEvent) => {
    if (isResizing.value || event.button !== 0) return
    const handle = event.currentTarget as HTMLElement

    downCoords.x = event.pageX
    downCoords.y = event.pageY

    initialTime.start = startTime.value
    initialTime.duration = endTime.value - startTime.value

    handle.setPointerCapture(event.pointerId)
    isResizing.value = handle === resizeLeft.value ? 'left' : 'right'
    event.stopPropagation()
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!isResizing.value) return

    const deltaS = (event.pageX - downCoords.x) / pixelsPerSecond.value

    let newStartTime
    let newDuration

    if (isResizing.value === 'left') {
      newStartTime = clamp(
        initialTime.start + deltaS,
        0,
        initialTime.start + initialTime.duration - MIN_CLIP_DURATION_S,
      )
      newDuration = endTime.value - startTime.value + (startTime.value - newStartTime)
      seekTo(newStartTime)
    } else {
      newStartTime = startTime.value
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
      class="clip is-selected can-resize-left"
      style={() =>
        `--clip-box-left:${boxEdges.value.left}px;--clip-box-right:${boxEdges.value.right}px;--clip-color:transparent`
      }
    >
      <div class="clip-box">
        <div class="clip-controls">
          <div ref={resizeLeft} class="clip-resize-left">
            <IconTablerChevronLeft />
          </div>
          <div ref={resizeRight} class="clip-resize-right">
            <IconTablerChevronRight />
          </div>
        </div>
      </div>
    </div>
  )
}

export const VideoTrimmerUI = (props: {
  source: MaybeRefOrGetter<string | Blob | undefined | null>
  state: MaybeRefOrGetter<TrimState | undefined>
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
  const muteOutput = ref(false)
  const currentTime = ref(0)
  const errorMessage = ref('')
  const unableToDecode = ref(!hasRequiredApis())

  const mediaDuration = ref(0)
  const startTime = ref(0)
  const endTime = ref(0)

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
    media.currentTime = currentTime.value = clamp(time, startTime.value, endTime.value)
  }

  effect(() => {
    media.muted = muteOutput.value

    const current = currentTime.value

    if (current < startTime.value) seekTo(startTime.value)
    else if (current >= endTime.value) {
      media.pause()
      seekTo(endTime.value)
    }
  })

  effect(async (onCleanup) => {
    const source = toValue(props.source)

    media.pause()
    errorMessage.value = ''
    unableToDecode.value = !hasRequiredApis()

    if (source == null || source === '') {
      mediaDuration.value = 0
      return
    }

    const isStringSource = typeof source === 'string'
    url = isStringSource ? source : URL.createObjectURL(source)
    let isStale = false as boolean

    onCleanup(() => {
      isStale = true
      if (!isStringSource) URL.revokeObjectURL(url)
    })

    let info
    try {
      info = await getContainerMetadata(url)
    } catch (error) {
      unableToDecode.value = true
      props.onError(error)

      try {
        info = await getMediaElementInfo(url)
      } catch {
        media.src = ''
        mediaDuration.value = 0
        errorMessage.value = String(error)
        props.onError(error)
        return
      }
    }
    if (isStale) return

    media.src = url
    media.load()
    mediaDuration.value = info.duration
    hasAudio.value = 'hasAudio' in info ? info.hasAudio : !!info.audio

    const stateIn = toValue(props.state)

    if (unableToDecode.value) {
      startTime.value = 0
      endTime.value = info.duration
    } else {
      startTime.value = stateIn?.start ?? 0
      endTime.value = stateIn?.end ?? info.duration
    }

    props.onLoad({ duration: info.duration, hasAudio: hasAudio.value })
  })

  effect(() => {
    if (!mediaDuration.value) return

    if (unableToDecode.value) {
      startTime.value = 0
      endTime.value = mediaDuration.value
      return
    }

    const stateIn = toValue(props.state)
    if (!stateIn) return

    const newStart = clamp(stateIn.start, 0, mediaDuration.value)
    startTime.value = newStart
    endTime.value = stateIn.end
  })

  effect(() => {
    const start = startTime.value
    const end = endTime.value

    const value = { start, end, mute: muteOutput.value, isFullDuration: end - start === mediaDuration.value }
    props.onChange?.(value)
  })

  const onTogglePlayback = (shouldPause: boolean) => {
    if (shouldPause) media.pause()
    else {
      if (currentTime.value >= endTime.value || media.ended) seekTo(startTime.value)
      media.play().catch(() => undefined)
    }
  }

  const onResize = (start: number, end: number, edge: 'left' | 'right') => {
    startTime.value = start
    endTime.value = end
    if (edge === 'left') seekTo(start)
    else seekTo(end)
  }

  return (
    <div
      class="video-trimmer"
      style={() => `--current-time-offset:${currentTime.value * pixelsPerSecond.value}px`}
    >
      <div part="viewport" class={() => ['viewport', readyState.value === 0 && 'is-empty']}>
        {h(media, { class: 'viewport-canvas' })}
        {() =>
          errorMessage.value && (
            <div class="video-trimmer-error" onClick={() => (errorMessage.value = '')}>
              {errorMessage}
            </div>
          )
        }
      </div>
      <div>
        <div class="video-trimmer-controls numeric">
          <ToggleButton
            class="video-trimmer-controls-left video-trimmer-play-pause"
            activeIcon={IconTablerPlayerPlay}
            inactiveIcon={IconTablerPlayerPause}
            isActive={isPaused}
            disabled={() => mediaDuration.value === 0}
            onToggle={onTogglePlayback}
          >
            <div class="sr-only">{() => (isPaused.value ? 'Play' : 'Pause')}</div>
          </ToggleButton>
          <div class="video-trimmer-controls-center">{() => formatTime(currentTime.value, false)}</div>
          <div class="video-trimmer-controls-right">
            <div>{() => formatDuration(Math.round(endTime.value - startTime.value))}</div>
            {() =>
              unableToDecode.value ? (
                <div></div>
              ) : hasAudio.value ? (
                <ToggleButton
                  activeIcon={IconTablerVolumeOff}
                  inactiveIcon={IconTablerVolume}
                  isActive={muteOutput}
                  onToggle={(shouldMute: boolean) => (muteOutput.value = shouldMute)}
                ></ToggleButton>
              ) : (
                <IconButton disabled icon={IconTablerVolume_3} onClick={() => undefined} />
              )
            }
          </div>
        </div>
        <div
          ref={timelineContainer}
          class="video-trimmer-timeline"
          onPointerDown={onScrubberDown}
          onPointerMove={onScrubberMove}
          onLostPointerCapture={onScrubberUp}
        >
          {() =>
            unableToDecode.value ? (
              <>
                <div class="clip">
                  <div class="video-trimmer-clip-warning">Editing this video format isn't supported</div>
                </div>
                <div class="video-trimmer-cursor" />
              </>
            ) : mediaDuration.value ? (
              <>
                <Clip
                  startTime={startTime}
                  endTime={endTime}
                  mediaDuration={mediaDuration}
                  pixelsPerSecond={pixelsPerSecond}
                  seekTo={seekTo}
                  onResize={onResize}
                />
                <div class="video-trimmer-cursor" />
              </>
            ) : (
              <div class="clip" />
            )
          }
        </div>
      </div>
      {props.children}
    </div>
  )
}
