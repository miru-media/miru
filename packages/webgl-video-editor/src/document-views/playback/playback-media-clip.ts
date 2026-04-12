import { createEffectScope, ref, watch } from 'fine-jsx'

import type * as pub from '#core'
import type { NonReadonly } from '#internal'
import { IS_FIREFOX } from 'shared/userAgent.ts'
import { useEventListener } from 'shared/utils/composables.ts'
import { createHiddenMediaElement } from 'shared/utils/images.ts'
import { ReadyState } from 'shared/video/constants.ts'
import { useInterval } from 'shared/video/utils.ts'

import { MEDIA_SYNC_INTERVAL_MS, MEDIA_SYNC_TOLERANCE_S } from '../../constants.ts'
import { CanvasEvent } from '../../events.ts'

import { MediaElementState } from './media-element-state.ts'
import { PlaybackClip } from './playback-clip.ts'
import type { PlaybackDocument } from './playback-document.ts'

export class PlaybackMediaClip<T extends pub.AnyMediaClip> extends PlaybackClip<T> {
  readonly mediaElement = createHiddenMediaElement(this.original.isAudio() ? 'audio' : 'video')
  readonly mediaTime = ref(0)
  readonly #scope = createEffectScope()
  readonly mediaState = new MediaElementState(this.#scope, this.mediaElement)

  get mediaIsPaused(): boolean {
    return this.mediaElement.paused
  }

  get isReady(): boolean {
    return super.isReady && this.mediaState.isReady.value
  }
  get shouldRender(): boolean {
    return super.shouldRender && this.mediaState.wasEverPlayable.value
  }

  get everHadEnoughData(): boolean {
    return this.mediaState.wasEverPlayable.value
  }

  constructor(playbackView: PlaybackDocument, original: T) {
    super(playbackView, original)
    const { renderClip } = this

    if (renderClip) {
      renderClip.sprite.eventMode = 'static'
      renderClip.sprite.on('pointerdown', (event) => {
        playbackView.doc.emit(new CanvasEvent('pointerdown', renderClip.original))
        event.stopPropagation()
      })

      watch([() => this.everHadEnoughData], ([everHadEnoughData]) => {
        if (!everHadEnoughData) return
        const { texture } = renderClip.sprite
        texture.source.resource = this.mediaElement as HTMLVideoElement
        texture.update()
      })
    }

    const { doc } = original
    const listenerOptions = { signal: this._disposeAbort.signal }
    doc.on('playback:play', this.#onPlay.bind(this), listenerOptions)
    doc.on('playback:pause', this.#onPause.bind(this), listenerOptions)
    doc.on('playback:update', this.#onPlaybackUpdate.bind(this), listenerOptions)
    doc.on('playback:seek', this.#onSeek.bind(this), listenerOptions)

    this.#scope.run(() => {
      // keep media element src updated
      watch(
        [() => original.asset?.blobUrl, () => original.asset?.isLoading === true],
        ([url, loading], _prev) => {
          if (loading) return

          const { mediaElement } = this
          if (url) {
            mediaElement.setAttribute('src', url)
            mediaElement.load()
          } else mediaElement.removeAttribute('src')
        },
      )

      useInterval(
        () => {
          if (!this.mediaState.isReady.value) return
          const { mediaElement } = this

          // seek if the media time is far from expected
          this.mediaTime.value = mediaElement.currentTime
          if (Math.abs(this.mediaTime.value - this.original.expectedMediaTime) > MEDIA_SYNC_TOLERANCE_S)
            this.seek()
        },
        MEDIA_SYNC_INTERVAL_MS,
        { active: () => !this.shouldPlay.value },
      )
    })

    useEventListener(this.mediaElement, 'canplay', this.#seekToWithinClip.bind(this))
    useEventListener(this.mediaElement, 'suspend', this.#seekToWithinClip.bind(this))
  }

  _update(key: keyof pub.AnyClip): void {
    if (key === 'enabled') {
      const { enabled } = this.original

      if (!enabled) this.mediaElement.pause()
      this.mediaElement.muted = !enabled
    }
  }

  seek(): void {
    const { mediaElement } = this

    const expectedTime = this.original.expectedMediaTime

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

  #onPlaybackUpdate(): void {
    if (!this.original.enabled) return

    const { renderClip, docView } = this

    if (this.isInPlayableTime.value) this.mediaTime.value = this.mediaElement.currentTime

    if (renderClip) {
      const { original } = renderClip
      const { asset } = original
      const { sprite } = renderClip

      // track changes to node properties
      void renderClip.pixiFilters.value
      void renderClip.matrix.value

      if (this.isInPresentationTime.value && asset) {
        if (this.mediaState.readyState.value >= ReadyState.HAVE_CURRENT_DATA) {
          const rotation = asset.video?.rotation ?? 0
          try {
            if (IS_FIREFOX && rotation % 180 && this.mediaElement instanceof HTMLVideoElement) {
              const { source } = sprite.texture
              const videoFrame = new VideoFrame(this.mediaElement, {
                timestamp: this.mediaElement.currentTime * 1e6,
              })

              ;(source.resource as Partial<VideoFrame>).close?.()
              source.resource = videoFrame
              source.update()
            } else sprite.texture.source.update()
          } catch {}
        }
      }
    }

    if (docView.isStalled) {
      if (!this.mediaIsPaused) this.pause()
    } else if (this.shouldPlay.value) {
      if (this.mediaIsPaused) this.#onPlay()
    } else if (!this.mediaIsPaused) this.pause()
  }

  #onSeek(): void {
    this.seek()
  }

  #seekToWithinClip(): void {
    if (this.mediaState.readyState.value < ReadyState.HAVE_FUTURE_DATA) return
    const { mediaElement } = this

    const { playableTime } = this.original
    const start = playableTime.source
    const end = start + playableTime.duration
    const { currentTime } = mediaElement

    if (currentTime < start && currentTime > end) mediaElement.currentTime = this.original.expectedMediaTime
  }

  dispose(): void {
    if (this.isDisposed) return

    const { mediaElement } = this
    mediaElement.removeAttribute('src')
    mediaElement.remove()

    super.dispose()
    this.#scope.stop()
    this._disposeAbort.abort()
    ;(this as Partial<NonReadonly<typeof this>>).mediaElement = undefined
  }
}
