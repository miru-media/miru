import { effect, h, type MaybeRefOrGetter, ref, toRef, toValue } from 'fine-jsx'
import * as Mb from 'mediabunny'

import { useEventListener } from 'shared/utils'
import { clamp } from 'shared/utils/math.ts'
import { useCursor } from 'shared/video/use-cursor.ts'
import { useScrubber } from 'shared/video/use-scrubber.ts'

import styles from '../media-trimmer.module.css'
import { TrimmerUiContext } from '../trimmer-ui-context.ts'
import type { LoadInfo, TrimState } from '../types/ui'

import { Clip } from './clip.jsx'
import { PlaybackControls } from './playback-controls.jsx'

export const VideoTrimmerUI = (props: {
  source: MaybeRefOrGetter<string | Blob | undefined | null>
  state: MaybeRefOrGetter<TrimState>
  onLoad: (info: LoadInfo) => void
  onChange: (state: TrimState) => void
  onError: (error: unknown) => void
  children?: unknown[]
}) => {
  let url = ''
  const scrubberContainer = ref<HTMLElement>()
  const scrubberCursor = ref<HTMLElement>()
  const context = new TrimmerUiContext(toRef(props.state), scrubberContainer, props.onChange)
  const root = ref<HTMLElement>()

  useScrubber(context, scrubberContainer, scrubberCursor)
  const cursorProps = useCursor(context, scrubberCursor)

  useEventListener(root, 'keydown', (event: KeyboardEvent) => {
    if (event.code === 'Space' && !(event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)) {
      context.togglePlayback()
      event.preventDefault()
      event.stopPropagation()
    }
  })

  effect(() => {
    const { media } = context
    const { end, mute } = context.state.value

    media.muted = mute

    if (context.currentTime.value >= end) {
      media.pause()
      context.seekTo(end)
    }
  })

  effect(async (onCleanup) => {
    const source = toValue(props.source)
    const { media } = context

    media.pause()
    context.errorMessage.value = ''

    if (source == null || source === '') {
      context.mediaDuration.value = 0
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
    const { hasAudio, unableToDecode, mediaDuration } = context

    hasAudio.value = !!audio
    unableToDecode.value = (await Promise.all([video?.canDecode(), audio?.canDecode()])).some(
      (can) => can === false,
    )
    const duration = await input.computeDuration()

    if (abort.signal.aborted) return

    media.src = url
    media.load()
    mediaDuration.value = duration

    const $state = context.state.value

    let start: number
    let end: number

    if (context.unableToDecode.value) {
      start = 0
      end = duration
    } else {
      start = Math.min($state.start, duration)
      end = $state.end === 0 ? duration : clamp($state.end, $state.start, duration)
    }

    if (context.currentTime.value < start) context.seekTo(start)

    props.onLoad({ duration, hasAudio: context.hasAudio.value })
    props.onChange({ start, end, mute: $state.mute })
  })

  return (
    <div
      ref={root}
      class={styles.videoTrimmer}
      style={() => `--current-time-offset:${context.currentTime.value * context.pixelsPerSecond.value}px`}
      tabindex="0"
    >
      <div class={() => [styles.viewport, context.readyState.value === 0 && styles.isEmpty]}>
        {h(context.media, { tabIndex: -1, class: styles.viewportCanvas })}
        {() =>
          context.errorMessage.value && (
            <div class={styles.error} onClick={() => (context.errorMessage.value = '')}>
              {context.errorMessage}
            </div>
          )
        }
      </div>
      <div>
        <PlaybackControls context={context} />

        <div ref={scrubberContainer} class={styles.timeline}>
          {() =>
            context.unableToDecode.value ? (
              <>
                <div class={styles.clip}>
                  <div class={styles.clipWarning}>Editing this video format isn't supported</div>
                </div>
                <div class={styles.cursor} />
              </>
            ) : context.mediaDuration.value ? (
              <>
                <Clip context={context} />
                <div ref={scrubberCursor} {...cursorProps} class={styles.cursor} />
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
