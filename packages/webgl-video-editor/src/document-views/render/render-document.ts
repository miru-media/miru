import * as Pixi from 'pixi.js'

import type * as pub from '../../../types/core'
import type { SettingsUpdateEvent } from '../../events.ts'
import { DocumentView, type ViewType } from '../document-view.ts'

import { RenderTimeline, RenderTrack, RenderVisualClip } from './render-nodes.ts'

interface ViewTypeMap {
  timeline: RenderTimeline
  track: RenderTrack
  clip: RenderVisualClip | undefined
}

export interface RenderDocumentOptions {
  doc: pub.Document
  applyVideoRotation: boolean
  gl?: WebGL2RenderingContext
  renderer?: Pixi.WebGLRenderer
}

export class RenderDocument extends DocumentView<ViewTypeMap> {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas
  readonly gl: WebGL2RenderingContext
  readonly renderer: Pixi.WebGLRenderer
  readonly stage: Pixi.Container
  declare whenRendererIsReady: Promise<void>

  readonly #createdOwnRenderer: boolean
  readonly applyVideoRotation: boolean

  constructor(options: RenderDocumentOptions) {
    super(options)

    this.applyVideoRotation = options.applyVideoRotation

    if (options.renderer) {
      this.renderer = options.renderer
      this.gl = options.renderer.gl
      this.#createdOwnRenderer = false
    } else {
      const { gl } = options
      if (!gl) throw new Error('[webgl-video-editor] options.gl or options.renderer must be provided.')

      this.gl = gl
      this.renderer = new Pixi.WebGLRenderer()
      this.#createdOwnRenderer = true
    }

    this.canvas = this.gl.canvas

    this._init()

    this.stage = this._getNode(options.doc.timeline).container
    this.whenRendererIsReady = this.#createdOwnRenderer ? this.#initPixi() : Promise.resolve()
  }

  async #initPixi(): Promise<void> {
    const { renderer, gl, canvas } = this
    try {
      await renderer.init({ context: gl, canvas })
    } catch (error) {
      this.doc.emit(new ErrorEvent('error', { error }))
    }

    const { width, height } = this.doc.resolution
    renderer.resize(width, height)
    this.doc.on('settings:update', this.#onSettingsUpdate.bind(this), { signal: this._abort.signal })
  }

  protected _createView<T extends pub.AnyNode>(original: T): ViewType<ViewTypeMap, T> {
    if (!original.isVisual()) return undefined as ViewType<ViewTypeMap, T>

    let view

    switch (original.type) {
      case 'timeline':
        view = new RenderTimeline(this, original)
        break
      case 'track':
        view = new RenderTrack(this, original)
        break
      case 'clip':
        view = new RenderVisualClip(this, original)
        break
    }

    return view as ViewType<ViewTypeMap, T>
  }

  #onSettingsUpdate(event: SettingsUpdateEvent): void {
    if (event.from.resolution) {
      const { width, height } = this.doc.resolution
      this.renderer.resize(width, height)
    }
  }

  render() {
    this.renderer.render({ container: this.stage })
  }

  /** @internal */
  _debug() {
    if (import.meta.env.DEV) {
      Object.assign(globalThis, {
        __PIXI_STAGE__: this.stage,
        __PIXI_RENDERER__: this.renderer,
      })
    }
  }

  dispose() {
    if (this.isDisposed) return

    super.dispose()
    if (this.#createdOwnRenderer) {
      this.renderer.destroy()
      this.renderer.removeAllListeners()
    }
  }
}
