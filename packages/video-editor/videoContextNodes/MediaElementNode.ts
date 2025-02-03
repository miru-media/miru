import { EffectScope, type Ref, watch } from 'fine-jsx'
import { type RenderGraph } from 'videocontext'

import { useEventListener } from 'shared/utils'

import { MEDIA_SYNC_INTERVAL_MS, MEDIA_SYNC_TOLERANCE_S } from '../constants'
import { type CustomSourceNodeOptions } from '../types'
import { useInterval } from '../utils'

import { CustomSourceNode } from './CustomSourceNode'
import { MediaNodeState } from './MediaNodeState'

export class MediaElementNode extends CustomSourceNode {
  media: HTMLVideoElement | HTMLAudioElement

  declare _gl: WebGL2RenderingContext

  mediaState: MediaNodeState
  mediaTime: Ref<number>
  scope = new EffectScope()

  get everHadEnoughData() {
    return this.mediaState.wasEverPlayable.value
  }

  get shouldRender() {
    return (
      this.mediaState.isReady.value &&
      super.shouldRender &&
      this.media.currentTime >= this.presentationTime.source
    )
  }

  constructor(
    // mandatory arguments from `VideoContext.customSourceNode()`
    media: HTMLMediaElement,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,

    // our options
    options: CustomSourceNodeOptions,
  ) {
    super(gl, renderGraph, currentTime, options)

    this.media = media
    this.mediaState = new MediaNodeState(this, options.movieIsPaused)
    this.mediaTime = this.mediaState.time

    media.currentTime = this.expectedMediaTime.value

    this.scope.run(() => {
      useInterval(
        () => {
          // seek if the media time is far from expected
          this.mediaTime.value = this.media.currentTime
          if (Math.abs(this.mediaTime.value - this.expectedMediaTime.value) > MEDIA_SYNC_TOLERANCE_S)
            this._seek(this.movieTime.value)
        },
        MEDIA_SYNC_INTERVAL_MS,
        { active: () => !this.shouldPlay.value },
      )

      watch([options.movieIsPaused], () => (this.mediaTime.value = media.currentTime))

      watch([this.shouldPlay], ([shouldPlay]) => {
        if (shouldPlay) this._play()
        else media.pause()
      })

      // seek to the media source starting time before the clip is scheduled to play
      watch([this.isInPreloadTime], ([isInPreloadTime]) => {
        if (isInPreloadTime) this._seek(this.movieTime.value)
      })
    })

    this._displayName = 'video-editor:VideoElementNode'
  }

  _isReady() {
    return this.mediaState.isReady.value || !this.isInPresentationTime.value
  }

  _seek(movieTime: number) {
    const mediaTime = super._seek(movieTime)
    const { media } = this
    if (mediaTime !== media.currentTime) media.currentTime = mediaTime

    return mediaTime
  }

  _pause() {
    this.media.muted = true
    this.media.pause()
  }

  _play() {
    if (!this.media.paused || !this.shouldPlay.value || this.mediaState.isSeeking.value) return

    this.media.muted = false
    this.media.play().catch(() => undefined)
  }

  destroy() {
    super.destroy()
    this.scope.stop()
    this.mediaState.scope.stop()
  }
}

export class VideoElementNode extends MediaElementNode {
  constructor(
    media: HTMLVideoElement,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,
    options: CustomSourceNodeOptions,
  ) {
    super(media, gl, renderGraph, currentTime, options)

    this.scope.run(() => {
      const getVideoSize = () => {
        const { mediaSize } = this
        mediaSize.width = media.videoWidth || 1
        mediaSize.height = media.videoHeight || 1
      }
      getVideoSize()
      useEventListener(media, 'loadedmetadata', getVideoSize)
    })
  }
}

export class AudioElementNode extends MediaElementNode {
  mediaState: MediaNodeState

  get everHadEnoughData() {
    return this.mediaState.wasEverPlayable.value
  }

  constructor(
    // mandatory arguments from `VideoContext.customSourceNode()`
    media: HTMLAudioElement,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,
    options: CustomSourceNodeOptions,
  ) {
    super(media, gl, renderGraph, currentTime, options)

    this.mediaState = new MediaNodeState(this, options.movieIsPaused)

    this._displayName = 'video-editor:AudioElementNode'
  }

  destroy() {
    super.destroy()
    this.mediaState.scope.stop()
  }
}
