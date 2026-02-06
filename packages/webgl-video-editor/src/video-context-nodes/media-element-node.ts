import { EffectScope, type Ref, watch } from 'fine-jsx'
import type { RenderGraph } from 'videocontext'

import { IS_ANDROID, IS_FIREFOX } from 'shared/userAgent'
import { useEventListener } from 'shared/utils'
import type { ReadyState } from 'shared/video/constants.ts'
import { getImageSize, useInterval } from 'shared/video/utils'

import type { CustomSourceNodeOptions } from '../../types/internal.ts'
import { MEDIA_SYNC_INTERVAL_MS, MEDIA_SYNC_TOLERANCE_S } from '../constants.ts'

import { CustomSourceNode } from './custom-source-node.ts'
import { MediaNodeState } from './media-node-state.ts'

export abstract class MediaElementNode extends CustomSourceNode {
  media: HTMLVideoElement | HTMLAudioElement
  textureRotation: number

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

  // eslint-disable-next-line @typescript-eslint/max-params -- matches parent class
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
    this.textureRotation = options.source.video?.rotation ?? 0
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
        else this._pause()
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

  _update(movieTime: number) {
    this.mediaState.readyState.value = this.media.readyState as ReadyState
    return super._update(movieTime)
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
  declare media: HTMLVideoElement

  get shouldRender() {
    if (!super.shouldRender) return false

    const { videoWidth, videoHeight } = this.media
    return !!(videoWidth && videoHeight)
  }

  // eslint-disable-next-line @typescript-eslint/max-params -- matches parent class
  constructor(
    media: HTMLVideoElement,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,
    options: CustomSourceNodeOptions,
  ) {
    super(media, gl, renderGraph, currentTime, options)

    this.scope.run(() => {
      const updateVideoSize = () => {
        const { mediaSize } = this
        const { width, height } = getImageSize(media)
        mediaSize.width = width || 1
        mediaSize.height = height || 1
      }
      updateVideoSize()
      useEventListener(media, 'loadedmetadata', updateVideoSize)
    })
  }

  getTextureImageSource() {
    const { media } = this
    const { videoWidth, videoHeight } = media
    if (!videoWidth || !videoHeight) return

    return IS_FIREFOX && !IS_ANDROID ? new VideoFrame(media, {}) : media
  }
}

export class AudioElementNode extends MediaElementNode {
  declare media: HTMLAudioElement
  mediaState: MediaNodeState

  get everHadEnoughData() {
    return this.mediaState.wasEverPlayable.value
  }

  // eslint-disable-next-line @typescript-eslint/max-params -- matches parent class
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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- stub
  getTextureImageSource() {
    return undefined
  }

  destroy() {
    super.destroy()
    this.mediaState.scope.stop()
  }
}
