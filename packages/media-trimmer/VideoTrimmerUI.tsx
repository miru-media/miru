import { h } from '@/framework/jsx-runtime'
import { computed, effect, type MaybeRefOrGetter, type Ref, ref, toValue } from '@/framework/reactivity'
import { useElementSize, useEventListener } from '@/utils'
import { clamp } from '@/utils/math'
import { BaseClip } from 'miru-video-editor/BaseClip'
import { IconButton } from 'miru-video-editor/components/IconButton'
import { ToggleButton } from 'miru-video-editor/components/ToggleButton'
import { formatDuration, formatTime, getVideoInfo } from 'miru-video-editor/utils'

import { getMediaInfo, hasRequiredApis } from './utils'

export interface LoadInfo {
  duration: number
  hasAudio: boolean
}

export interface TrimState {
  start: number
  end: number
  mute: boolean
  isFullDuration?: boolean
}

const MIN_CLIP_DURATION_S = 0.25
const MIN_CLIP_WIDTH_PX = 1

const Clip = ({
  clip,
  pixelsPerSecond,
  mediaDuration,
  seekTo,
}: {
  clip: BaseClip
  pixelsPerSecond: Ref<number>
  mediaDuration: Ref<number>
  seekTo: (time: number) => void
}) => {
  const resizeLeft = ref<HTMLElement>()
  const resizeRight = ref<HTMLElement>()
  const boxEdges = computed(() => {
    const { time } = clip

    const left = time.source * pixelsPerSecond.value
    const width = Math.max(MIN_CLIP_WIDTH_PX, time.duration * pixelsPerSecond.value)
    const right = left + width

    return { left, right }
  })

  const isResizing = ref<'left' | 'right'>()
  const downCoords = { x: 0, y: 0 }
  const initialTime = { source: 0, duration: 0 }

  const onPointerDown = (event: PointerEvent) => {
    if (isResizing.value || event.button !== 0) return
    const handle = event.currentTarget as HTMLElement

    downCoords.x = event.pageX
    downCoords.y = event.pageY
    Object.assign(initialTime, clip.time)

    handle.setPointerCapture(event.pointerId)
    isResizing.value = handle === resizeLeft.value ? 'left' : 'right'
    event.stopPropagation()
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!isResizing.value) return

    const deltaS = (event.pageX - downCoords.x) / pixelsPerSecond.value

    let newSourceTime
    let newDuration

    if (isResizing.value === 'left') {
      newSourceTime = clamp(
        initialTime.source + deltaS,
        0,
        initialTime.source + initialTime.duration - MIN_CLIP_DURATION_S,
      )
      newDuration = clip.time.duration + (clip.time.source - newSourceTime)
      seekTo(newSourceTime)
    } else {
      newSourceTime = clip.time.source
      newDuration = clamp(
        initialTime.duration + deltaS,
        MIN_CLIP_DURATION_S,
        mediaDuration.value - initialTime.source,
      )
      seekTo(newSourceTime + newDuration)
    }

    clip.sourceStart.value = newSourceTime
    clip.duration.value = newDuration
    clip.ensureDurationIsPlayable()
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
  media.playsInline = true
  media.preload = 'auto'

  const clip = ref<BaseClip>()
  const mediaDuration = ref(0)
  const timelineContainer = ref<HTMLElement>()
  const isScrubbing = ref(false)
  const containerSize = useElementSize(timelineContainer)
  const pixelsPerSecond = computed(() => containerSize.value.width / mediaDuration.value || 0)
  const isPaused = ref(true)
  const hasAudio = ref(false)
  const muteOutput = ref(false)
  const currentTime = ref(0)
  const startTime = computed(() => clip.value?.time.source ?? 0)
  const endTime = computed(() => {
    if (!clip.value) return mediaDuration.value

    const { source, duration } = clip.value.time
    return source + duration
  })
  const errorMessage = ref('')
  const unableToDecode = ref(!hasRequiredApis())

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
      clip.value = undefined
      mediaDuration.value = 0
      return
    }

    const isStringSource = typeof source === 'string'
    url = isStringSource ? source : URL.createObjectURL(source)
    let newClip: BaseClip | undefined = undefined
    let isStale = false as boolean

    onCleanup(() => {
      isStale = true
      if (!isStringSource) URL.revokeObjectURL(url)
      newClip?.dispose()
    })

    let info
    try {
      info = await getMediaInfo(url)
    } catch (error) {
      unableToDecode.value = true
      props.onError(error)

      try {
        info = await getVideoInfo(url)
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
    hasAudio.value = info.hasAudio

    const stateIn = toValue(props.state)

    let sourceStart
    let duration

    if (unableToDecode.value) {
      sourceStart = 0
      duration = info.duration
    } else {
      duration = stateIn ? stateIn.end - stateIn.start : info.duration
      sourceStart = stateIn?.start ?? 0
    }

    newClip = clip.value = new BaseClip({
      source: media,
      sourceStart,
      duration,
    })

    props.onLoad({ duration, hasAudio: info.hasAudio })
  })

  effect(() => {
    const $clip = clip.value
    if (!$clip) return

    if (unableToDecode.value) {
      $clip.sourceStart.value = 0
      $clip.duration.value = mediaDuration.value
      return
    }

    const stateIn = toValue(props.state)
    if (!stateIn) return

    const newStart = clamp(stateIn.start, 0, mediaDuration.value)
    $clip.sourceStart.value = newStart
    $clip.duration.value = clamp(stateIn.end - newStart, 0, mediaDuration.value - newStart)
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

  return (
    <div
      class="video-trimmer"
      style={() => `--current-time-offset:${currentTime.value * pixelsPerSecond.value}px`}
    >
      <div
        part="viewport"
        class={() => ['viewport', (clip.value?.readyState.value ?? 0) === 0 && 'is-empty']}
      >
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
            <div>{() => formatDuration(clip.value?.time.duration ?? 0)}</div>
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
            ) : clip.value ? (
              <>
                <Clip
                  clip={clip.value}
                  mediaDuration={mediaDuration}
                  pixelsPerSecond={pixelsPerSecond}
                  seekTo={seekTo}
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
