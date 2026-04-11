import { computed, createEffectScope, effect, ref, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'
import Stats from 'stats.js'

import { useDocumentVisibility } from 'shared/utils/composables.ts'

import type * as pub from '../../../types/core'
import { ASSET_URL_REFRESH_TIMEOUT_MS } from '../../constants.ts'
import { CanvasEvent, PlaybackPauseEvent, PlaybackPlayEvent, PlaybackUpdateEvent } from '../../events.ts'
import { DocumentView, type ViewType } from '../document-view.ts'
import type { RenderDocument } from '../render/render-document.ts'

import { PlaybackClip } from './playback-clip.ts'

const CLIP_STALLED_DELAY_MS = 100
const UPDATE_EVENT = new PlaybackUpdateEvent()
const PLAY_EVENT = new PlaybackPlayEvent()
const PAUSE_EVENT = new PlaybackPauseEvent()

interface ViewTypeMap {
  'clip:video': PlaybackClip
  'clip:audio': PlaybackClip
}

export class PlaybackDocument extends DocumentView<ViewTypeMap> {
  readonly renderView: RenderDocument
  readonly stats = new Stats()
  readonly ticker = new Pixi.Ticker()

  readonly #scope = createEffectScope()
  readonly #noRender = ref(0)
  readonly #delayedActiveClipIsStalled = ref(false)

  readonly #isEnded = computed(() => this.currentTime >= this.doc.duration)
  readonly #isPaused = ref(true)
  readonly #isStalled = computed(() => !this.#isPaused.value && !this.isReady)

  readonly assetFiles = new Map<string, { blob: Blob; url: string }>()

  get currentTime(): number {
    return this.doc.currentTime
  }

  get isEnded(): boolean {
    return this.#isEnded.value
  }
  get isPaused(): boolean {
    return this.#isPaused.value
  }
  get isStalled(): boolean {
    return this.#isStalled.value
  }

  get isReady(): boolean {
    return this.#noRender.value > 0 || !this.#delayedActiveClipIsStalled.value
  }

  constructor(options: { renderView: RenderDocument }) {
    const { renderView } = options
    super(renderView.doc)

    this.renderView = renderView

    this._init()

    this.#scope.run(() => {
      watch([() => this.isStalled], ([stalled], _prev, onCleanup) => {
        if (!stalled) return

        const timeoutId = setTimeout(() => {
          for (const asset of this.doc.assets.values())
            if (asset.type === 'asset:media:av') void asset._refreshObjectUrl()
        }, ASSET_URL_REFRESH_TIMEOUT_MS)
        onCleanup(() => clearTimeout(timeoutId))
      })
    })

    this.ticker.add(this.tick.bind(this))

    void this.renderView.whenRendererIsReady.then(() => {
      this.#scope.run(() => {
        const documentVisibility = useDocumentVisibility()
        watch([() => this.#noRender.value <= 0 && documentVisibility.value], ([shouldRender]) => {
          const { ticker } = this
          if (shouldRender) ticker.start()
          else ticker.stop()
        })
      })
    })

    this.#scope.run(() => {
      let activeClipIsStalledTimeout: any

      effect((onCleanup) => {
        if (this.doc.activeClipIsStalled.value)
          activeClipIsStalledTimeout = setTimeout(() => {
            this.#delayedActiveClipIsStalled.value = true
          }, CLIP_STALLED_DELAY_MS)
        else this.#delayedActiveClipIsStalled.value = false

        onCleanup(() => clearTimeout(activeClipIsStalledTimeout))
      })
    })

    const { stage } = this.renderView
    stage.eventMode = 'static'
    stage.on('pointerdown', () => this.doc.emit(new CanvasEvent('pointerdown', undefined)))
    stage.on('pointermove', () => this.doc.emit(new CanvasEvent('pointermove', undefined)))
    stage.on('pointerup', () => this.doc.emit(new CanvasEvent('pointerup', undefined)))
    stage.on('pointerupoutside', () => this.doc.emit(new CanvasEvent('pointerup', undefined)))

    this.stats.showPanel(0)
    if (import.meta.env.DEV) this.renderView._debug()
  }

  protected _createView<T extends pub.AnyNode>(original: T): ViewType<ViewTypeMap, T> {
    let view

    if (original.isClip()) view = new PlaybackClip(this, original)
    else view = undefined

    return view as ViewType<ViewTypeMap, T>
  }

  /**
   * This method is called by the {@link Pixi.Ticker} every `requestAnimationFrame` and is used to update the
   * `doc.currentTime`, emit the playback udpate event and render when needed.
   *
   * While paused, we and render inside a computed getter so that reactive values are tracked and the getter
   * with all of its side effects are run only if a reactive dependency has changed.
   *
   * While playing, we always call the render method directly, but we still access the computed value which
   * will then only track the reactive values that tell us that we're playing and return without rendering
   * again.
   */
  tick(): void {
    if (this.#noRender.value) return

    const shouldAdvance = !this.isPaused && this.isReady
    const { deltaMS } = this.ticker
    const { duration } = this.doc

    // While playing, update current time and render.
    if (shouldAdvance) {
      this.stats.begin()
      this.doc._setCurrentTime(Math.min(this.currentTime + deltaMS / 1e3, duration))
      this._updateAndRender(false)
    }

    // Always read the computed value, which checks playback status and skips rendering while playing.
    void this._updateAndRenderReactive.value

    if (shouldAdvance) {
      if (this.currentTime >= this.doc.duration) this.pause()
      this.stats.end()
    }
  }

  _updateAndRender(skipWhilePlaying: boolean): unknown {
    if (skipWhilePlaying && !this.isPaused && this.isReady) return

    this.doc.emit(UPDATE_EVENT)
    this.renderView.render()
    return undefined
  }

  _updateAndRenderReactive = computed(this._updateAndRender.bind(this, true))

  play(): void {
    if (this.#noRender.value) return
    if (this.isEnded) this.doc.seekTo(0)
    if (this.isPaused) {
      this.doc.emit(PLAY_EVENT)
      this.#isPaused.value = false
    }
  }

  pause(): void {
    if (!this.#isPaused.value) {
      this.doc.emit(PAUSE_EVENT)
      this.#isPaused.value = true
    }
  }

  async withoutRendering(fn: () => Promise<void>): Promise<void> {
    this.#noRender.value += 1
    await fn().finally(() => void (this.#noRender.value -= 1))
  }

  dispose(): void {
    if (this.isDisposed) return

    super.dispose()
    this.#scope.stop()
    this.ticker.destroy()
  }
}
