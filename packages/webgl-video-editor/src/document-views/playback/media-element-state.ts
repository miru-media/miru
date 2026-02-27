import { computed, type EffectScope, onScopeDispose, ref, type Ref, watch } from 'fine-jsx'

import { ReadyState } from 'shared/video/constants.ts'
import { useMediaError, useMediaReadyState } from 'shared/video/utils'

export class MediaElementState {
  declare readyState: Ref<ReadyState>
  declare error: Ref<MediaError | undefined>
  readonly latestEvent = ref<Event>()
  readonly wasEverPlayable = ref(false)
  readonly isSeeking = ref(false)
  readonly isReady = computed(
    () => this.readyState.value >= ReadyState.HAVE_CURRENT_DATA && !this.isSeeking.value,
  )
  readonly isPaused = ref(true)
  readonly #abort = new AbortController()

  constructor(scope: EffectScope, mediaElement: HTMLMediaElement) {
    this.isPaused.value = mediaElement.paused

    const listenerOptions = { signal: this.#abort.signal }

    scope.run(() => {
      this.readyState = useMediaReadyState(mediaElement)
      this.error = useMediaError(mediaElement)

      onScopeDispose(this.#onDispose.bind(this))
    })

    mediaElement.addEventListener('play', this.#onPlay.bind(this), listenerOptions)
    mediaElement.addEventListener('pause', this.#onPause.bind(this), listenerOptions)

    watch([this.readyState], ([readyState]) => {
      if (readyState >= ReadyState.HAVE_CURRENT_DATA) this.wasEverPlayable.value = true
    })

    const allReadyStateEventTypes = [
      'abort',
      'canplay',
      'canplaythrough',
      'durationchange',
      'emptied',
      'ended',
      'error',
      'loadeddata',
      'loadedmetadata',
      'loadstart',
      'pause',
      'play',
      'playing',
      'seeked',
      'seeking',
      'stalled',
      'suspend',
      'timeupdate',
      'waiting',
    ]
    allReadyStateEventTypes.forEach((type) => {
      mediaElement.addEventListener(
        type,
        (event) => {
          this.latestEvent.value = event
          const mediaElement = event.target as HTMLMediaElement

          this.isSeeking.value =
            type === 'seeking' ? true : mediaElement.readyState < ReadyState.HAVE_ENOUGH_DATA
        },
        listenerOptions,
      )
    })
  }

  #onPlay(): void {
    this.isPaused.value = false
  }
  #onPause(): void {
    this.isPaused.value = true
  }

  #onDispose(): void {
    this.#abort.abort()
    this.latestEvent.value = undefined
  }
}
