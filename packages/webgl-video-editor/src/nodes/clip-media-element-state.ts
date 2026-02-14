import { computed, ref, type Ref, watch } from 'fine-jsx'

import { useEventListener } from 'shared/utils'
import { ReadyState } from 'shared/video/constants.ts'
import { useMediaReadyState } from 'shared/video/utils'

import type { Clip } from './clip.ts'

export class ClipMediaElementState {
  clip: Clip
  readyState!: Ref<ReadyState>
  latestEvent = ref<Event>()
  wasEverPlayable = ref(false)
  isSeeking = ref(false)
  isReady = computed(() => this.readyState.value >= ReadyState.HAVE_CURRENT_DATA && !this.isSeeking.value)
  isPaused = ref(true)

  constructor(clip: Clip) {
    this.clip = clip
    const { media } = clip

    this.isPaused.value = media.value.paused
    useEventListener(media, 'play', this.#onPlay.bind(this))
    useEventListener(media, 'pause', this.#onPause.bind(this))

    this.clip.scope.run(() => {
      this.readyState = useMediaReadyState(media)

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
        useEventListener(media, type, (event) => {
          this.latestEvent.value = event
          const mediaElement = event.target as HTMLMediaElement

          this.isSeeking.value =
            type === 'seeking' ? true : mediaElement.readyState < ReadyState.HAVE_ENOUGH_DATA
        })
      })

      watch([clip.media], () => (this.wasEverPlayable.value = false))

      watch([this.readyState], ([readyState]) => {
        if (readyState >= ReadyState.HAVE_CURRENT_DATA) this.wasEverPlayable.value = true
      })

      useEventListener(media, 'canplay', this.#seekToWithinClip.bind(this))
      useEventListener(media, 'suspend', this.#seekToWithinClip.bind(this))
    })
  }

  #onPlay(): void {
    this.isPaused.value = false
  }
  #onPause(): void {
    this.isPaused.value = true
  }

  #seekToWithinClip(): void {
    if (this.readyState.value < ReadyState.HAVE_FUTURE_DATA) return
    const { mediaElement } = this.clip.playback

    const { playableTime } = this.clip
    const start = playableTime.source
    const end = start + playableTime.duration
    const { currentTime } = mediaElement

    if (currentTime < start && currentTime > end) mediaElement.currentTime = this.clip.expectedMediaTime
  }

  dispose(): void {
    this.clip = undefined as never
    this.latestEvent.value = undefined
  }
}
