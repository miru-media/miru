import * as Pixi from 'pixi.js'

import type * as pub from '../../../types/core'
import type { SettingsUpdateEvent } from '../../events.ts'
import { DocumentView, type ViewType } from '../document-view.ts'

import { LutUploaderSystem } from './pixi-lut-source.ts'
import { RenderTextClip, RenderTimeline, RenderTrack, RenderVideoClip } from './render-nodes.ts'

Pixi.extensions.add(LutUploaderSystem)

interface ViewTypeMap {
  timeline: RenderTimeline
  track: RenderTrack
  'clip:video': RenderVideoClip | undefined
  'clip:text': RenderTextClip
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
  declare stage: Pixi.Container
  declare whenRendererIsReady: Promise<void>

  readonly #ownsRenderer: boolean
  readonly applyVideoRotation: boolean

  constructor(options: RenderDocumentOptions) {
    const { doc } = options
    super(doc)

    this.applyVideoRotation = options.applyVideoRotation

    if (options.renderer) {
      this.renderer = options.renderer
      this.gl = options.renderer.gl
      this.#ownsRenderer = false
    } else {
      const { gl } = options
      if (!gl) throw new Error('[webgl-video-editor] options.gl or options.renderer must be provided.')

      this.gl = gl
      this.renderer = new Pixi.WebGLRenderer()
      this.#ownsRenderer = true
    }

    this.canvas = this.gl.canvas

    this._init()

    this.whenRendererIsReady = this.#ownsRenderer ? this.#initPixi() : Promise.resolve()
  }

  async #initPixi(): Promise<void> {
    const { renderer, gl, canvas } = this
    try {
      await renderer.init({ context: gl, canvas })
      const { width, height } = this.doc.resolution
      renderer.resize(width, height)
    } catch (error) {
      this.doc.emit(new ErrorEvent('error', { error }))
    }

    this.doc.on('settings:update', this.#onSettingsUpdate.bind(this), { signal: this._abort.signal })
  }

  protected _createView<T extends pub.AnyNode>(original: T): ViewType<ViewTypeMap, T> {
    if (!original.isVideo()) return undefined as ViewType<ViewTypeMap, T>

    let view

    switch (original.type) {
      case 'timeline':
        view = new RenderTimeline(this, original)
        this.stage = view.pixiNode
        break
      case 'track':
        view = new RenderTrack(this, original)
        break
      case 'clip:video':
        view = new RenderVideoClip(this, original)
        break
      case 'clip:text':
        view = new RenderTextClip(this, original)
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

    if (this.#ownsRenderer) {
      this.renderer.destroy()
      // https://github.com/pixijs/pixijs/pull/11951
      this.renderer.removeAllListeners()
    }
  }
}
