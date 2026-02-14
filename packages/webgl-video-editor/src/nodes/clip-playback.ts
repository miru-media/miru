import { computed, ref, type Ref } from 'fine-jsx'

import { ReadyState } from 'shared/video/constants.ts'
import { rangeContainsTime, useInterval } from 'shared/video/utils.ts'

import { MEDIA_SYNC_INTERVAL_MS, MEDIA_SYNC_TOLERANCE_S } from '../constants.ts'

import { ClipMediaElementState } from './clip-media-element-state.ts'
import type { Clip } from './index.ts'

export class ClipPlayback {
  declare media?: TexImageSource | HTMLAudioElement

  clip: Clip
  mediaTime = ref(0)
  mediaState: ClipMediaElementState

  everHadEnoughData: Ref<boolean>
  imageChanged = true

  isInPresentationTime = computed(() => {
    const { presentationTime, root } = this.clip
    const movieTime = root.currentTime

    return (
      rangeContainsTime(presentationTime, movieTime) ||
      // display final frame of clip at the end of the movie
      (movieTime > presentationTime.start && presentationTime.end === root.duration)
    )
  })
  isInPlayableTime = computed(() => rangeContainsTime(this.clip.playableTime, this.clip.root.currentTime))
  isInClipTime = computed(() => rangeContainsTime(this.clip.time, this.clip.root.currentTime))

  shouldPlay = computed(() => {
    const { root } = this.clip
    return this.isInPlayableTime.value && !root.isPaused.value
  })

  get mediaElement(): HTMLMediaElement {
    return this.clip.media.value
  }

  get shouldRender() {
    return this.isInPresentationTime.value
  }

  get mediaIsPaused() {
    return this.mediaElement.paused
  }

  readonly #disposeAbort = new AbortController()

  constructor(clip: Clip) {
    this.clip = clip
    const movie = clip.root

    this.mediaState = new ClipMediaElementState(clip)
    this.everHadEnoughData = this.mediaState.wasEverPlayable

    const listenerOptions = { signal: this.#disposeAbort.signal }
    movie.on('playback:play', this.#onPlay.bind(this), listenerOptions)
    movie.on('playback:pause', this.#onPause.bind(this), listenerOptions)
    movie.on('playback:update', this.#onUpdate.bind(this), listenerOptions)
    movie.on('playback:seek', this.#onSeek.bind(this), listenerOptions)

    clip.scope.run(() => {
      useInterval(
        () => {
          if (!this.mediaState.isReady.value) return
          const { mediaElement } = this

          // seek if the media time is far from expected
          this.mediaTime.value = mediaElement.currentTime
          if (Math.abs(this.mediaTime.value - this.clip.expectedMediaTime) > MEDIA_SYNC_TOLERANCE_S)
            this.seek()
        },
        MEDIA_SYNC_INTERVAL_MS,
        { active: () => !this.shouldPlay.value },
      )
    })
    this.clip.onDispose(this.dispose.bind(this))
  }

  seek(): void {
    const { mediaElement } = this

    const expectedTime = this.clip.expectedMediaTime

    if (mediaElement.currentTime !== expectedTime) {
      mediaElement.currentTime = expectedTime
    }
  }

  play(): void {
    const { mediaElement } = this
    mediaElement.play().catch(() => undefined)
    mediaElement.muted = false
    this.mediaTime.value = mediaElement.currentTime
  }

  pause(): void {
    const { mediaElement } = this

    mediaElement.pause()
    mediaElement.muted = true
    this.mediaTime.value = mediaElement.currentTime
  }

  #onPlay(): void {
    if (this.isInPlayableTime.value) {
      this.seek()
      this.play()
    } else this.pause()
  }

  #onPause(): void {
    if (!this.mediaElement.paused) {
      this.seek()
      this.pause()
    }
  }

  #onUpdate(): void {
    const { rendererNode } = this.clip

    if (this.isInPresentationTime.value) rendererNode.visible ||= this.mediaState.wasEverPlayable.value
    else rendererNode.visible &&= false

    if (this.isInPlayableTime.value) {
      this.mediaTime.value = this.mediaElement.currentTime
      if (this.mediaState.readyState.value >= ReadyState.HAVE_CURRENT_DATA)
        rendererNode.texture.source.update()
    }

    if (this.clip.root.isStalled.value) {
      if (!this.mediaIsPaused) this.pause()
    } else if (this.shouldPlay.value) {
      if (this.mediaIsPaused) this.#onPlay()
    } else if (!this.mediaIsPaused) this.pause()
  }

  #onSeek(): void {
    this.seek()
  }

  dispose(): void {
    this.clip = undefined as never
    this.#disposeAbort.abort()
  }
}
