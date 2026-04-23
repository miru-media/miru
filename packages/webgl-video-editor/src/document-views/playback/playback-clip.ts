import { computed, createEffectScope, watch } from 'fine-jsx'

import type * as pub from '#core'
import { rangeContainsTime } from 'shared/video/utils.ts'

import { CanvasEvent } from '../../events.ts'
import { NodeView } from '../node-view.ts'
import type { RenderTextClip, RenderVideoClip } from '../render/render-nodes.ts'

import type { PlaybackDocument } from './playback-document.ts'

export class PlaybackClip<T extends pub.AnyClip> extends NodeView<PlaybackDocument, T> {
  readonly renderClip = this.docView.renderView._getNode(this.original)
  readonly #scope = createEffectScope()

  isInPresentationTime = computed(() => {
    if (this.isDisposed) return false

    const { presentationTime, doc } = this.original
    const docTime = doc.currentTime

    return (
      rangeContainsTime(presentationTime, docTime) ||
      // display final frame of clip at the end of the timeline
      (docTime > presentationTime.start && presentationTime.end === doc.duration)
    )
  })
  isInPlayableTime = computed(
    () => !this.isDisposed && rangeContainsTime(this.original.playableTime, this.original.doc.currentTime),
  )

  shouldPlay = computed(() => this.isInPlayableTime.value && !this.docView.isPaused)

  get isReady(): boolean {
    return this.original.isReady && this.renderClip?.isReady.value === true
  }
  get shouldRender(): boolean {
    return this.isInPresentationTime.value
  }

  readonly _disposeAbort = new AbortController()

  constructor(playbackView: PlaybackDocument, original: T) {
    super(playbackView, original)
    const { renderClip } = this

    if (renderClip) {
      renderClip.pixiNode.eventMode = 'static'
      renderClip.pixiNode.on('pointerdown', (event) => {
        playbackView.doc.emit(new CanvasEvent('pointerdown', renderClip.original))
        event.stopPropagation()
      })

      original.doc.on('playback:update', this.#onPlaybackUpdate.bind(this, renderClip), {
        signal: this._disposeAbort.signal,
      })

      if (this.original.isTextClip()) {
        const text = this.original

        this.#scope.run(() => {
          watch(
            [
              () => text.content,
              () => text.fontFamily,
              () => text.fontSize,
              () => text.fontWeight,
              () => text.fontStyle,
              () => text.align,
              () => text.inlineSize,
              () => text.fill,
              () => text.stroke,
            ],
            () => {
              if (this.isDisposed) return
              this.docView._updateAndRender(false)
            }

          )
        })


        void this.docView.renderView.whenRendererIsReady.then(() => {
          if (this.isDisposed) return
          this.docView._updateAndRender(false)
        })
      }
    }
  }

  #onPlaybackUpdate(renderClip: RenderVideoClip | RenderTextClip): void {
    if (!this.original.enabled) return

    const { pixiNode } = renderClip

    // track changes to node properties
    void renderClip.pixiFilters.value
    void renderClip.matrix.value

    if (this.shouldRender) pixiNode.visible ||= true
    else pixiNode.visible &&= false
  }

  dispose(): void {
    if (this.isDisposed) return

    super.dispose()
    this._disposeAbort.abort()
    this.#scope.stop()
  }
}
