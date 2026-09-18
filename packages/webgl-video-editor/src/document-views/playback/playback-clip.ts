import { computed } from 'fine-jsx'

import type * as pub from '#core'

import { CanvasEvent } from '../../events.ts'
import { NodeView } from '../node-view.ts'
import type { AnyRenderClip } from '../render/index.ts'

import type { PlaybackDocument } from './playback-document.ts'

export class PlaybackClip<T extends pub.AnyClip> extends NodeView<PlaybackDocument, T> {
  readonly renderClip = this.docView.renderView._getNode(this.original)

  shouldPlay = computed(() => this.original.isInPlayableTime && !this.docView.isPaused)

  get isReady(): boolean {
    return this.original.isReady && this.renderClip?.isReady !== false
  }
  get shouldRender(): boolean {
    return this.isReady && this.original.isInPresentationTime
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
    }
  }

  #onPlaybackUpdate(renderClip: AnyRenderClip): void {
    if (!this.original.enabled) return

    const { pixiNode } = renderClip

    // track changes to node properties
    void renderClip._reactiveRenderProps.value

    if (this.shouldRender) pixiNode.visible ||= true
    else pixiNode.visible &&= false
  }

  dispose(): void {
    if (this.isDisposed) return

    super.dispose()
    this._disposeAbort.abort()
  }
}
