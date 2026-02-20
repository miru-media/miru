import { createEffectScope, effect, ref, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'
import Stats from 'stats.js'

import type { Size } from 'shared/types'
import { getWebgl2Context, useDocumentVisibility } from 'shared/utils'

import type { AnyNode, NodesByType } from '../../types/internal'
import type { AvMediaAsset } from '../../types/schema'
import { MediaAsset, VideoEffectAsset } from '../assets.ts'
import { ASSET_URL_REFRESH_TIMEOUT_MS } from '../constants.ts'
import { PlaybackUpdateEvent } from '../events.ts'

import { BaseMovie } from './base-movie.ts'
import { Clip, Gap, type Schema } from './index.ts'
import { Timeline } from './timeline.ts'
import { Track } from './track.ts'

export namespace Movie {
  export interface Init {
    children: Schema.Track
    resolution: Size
    frameRate: number
  }
}

const CLIP_STALLED_DELAY_MS = 100

const UPDATE_EVENT = new PlaybackUpdateEvent()

export class Movie extends BaseMovie {
  readonly #scope = createEffectScope()

  readonly #noRender = ref(0)

  readonly stats = new Stats()
  ticker = new Pixi.Ticker()

  declare canvas: HTMLCanvasElement

  readonly #delayedActiveClipIsStalled = ref(false)

  get isReady(): boolean {
    return this.#noRender.value > 0 || !this.#delayedActiveClipIsStalled.value
  }

  constructor() {
    const gl = getWebgl2Context(document.createElement('canvas'), { stencil: true })
    super({ gl })

    this.#scope.run(() => {
      watch([this.isStalled], ([stalled], _prev, onCleanup) => {
        if (!stalled) return

        const refreshAssetUrl = (asset: MediaAsset | VideoEffectAsset) => {
          if (asset.type === 'asset:media:av') void asset._refreshObjectUrl()
        }

        const timeoutId = setTimeout(() => this.assets.forEach(refreshAssetUrl), ASSET_URL_REFRESH_TIMEOUT_MS)
        onCleanup(() => clearTimeout(timeoutId))
      })
    })

    this.ticker.add(this.tick.bind(this))

    void this.whenRendererIsReady.then(() => {
      this.#scope.run(() => {
        const documentVisibility = useDocumentVisibility()
        watch([() => this.#noRender.value <= 0 && documentVisibility.value], ([shouldRender]) => {
          const { ticker } = this
          if (shouldRender) ticker.start()
          else ticker.stop()
        })
      })
    })

    if (import.meta.env.DEV) {
      Object.assign(globalThis, {
        __PIXI_STAGE__: this.stage,
        __PIXI_RENDERER__: this.renderer,
      })
    }

    this.#scope.run(() => {
      let activeClipIsStalledTimeout: any

      effect((onCleanup) => {
        if (this.activeClipIsStalled.value)
          activeClipIsStalledTimeout = setTimeout(
            () => (this.#delayedActiveClipIsStalled.value = true),
            CLIP_STALLED_DELAY_MS,
          )
        else this.#delayedActiveClipIsStalled.value = false

        onCleanup(() => clearTimeout(activeClipIsStalledTimeout))
      })
    })

    this.stats.showPanel(0)

    this.onDispose(() => {
      this.#scope.stop()
      this.ticker.destroy()
    })
  }

  createNode<T extends Schema.AnyNodeSchema>(init: T): NodesByType[T['type']] {
    let node: AnyNode

    switch (init.type) {
      case 'timeline':
        node = new Timeline(init, this)
        break
      case 'track':
        node = new Track(init, this)
        break
      case 'clip':
        node = new Clip(init, this)
        break
      case 'gap':
        node = new Gap(init, this)
        break
      default:
        throw new Error(`[webgl-video-editor] Unexpected init of type "${init.type}".`)
    }

    return node as NodesByType[T['type']]
  }

  createAsset<T extends Schema.AnyAsset>(
    init: T,
    source?: Blob | string,
  ): T extends Schema.VideoEffectAsset ? VideoEffectAsset : AvMediaAsset {
    const asset =
      init.type === 'asset:effect:video'
        ? new VideoEffectAsset(init, this)
        : new MediaAsset(init, { root: this, source: source ?? init.url })

    return asset as T extends Schema.VideoEffectAsset ? VideoEffectAsset : AvMediaAsset
  }

  tick(): void {
    if (this.#noRender.value) return

    const shouldAdvance = !this.isPaused.value && this.isReady
    const { deltaMS } = this.ticker

    if (shouldAdvance) {
      this.stats.begin()
      this._currentTime.value = Math.min(this.currentTime + deltaMS / 1e3, this.duration)
    }

    this._emit(UPDATE_EVENT)

    this.renderer.render({ container: this.stage })

    if (shouldAdvance) {
      if (this.currentTime >= this.duration) this.pause()
      this.stats.end()
    }
  }

  play(): void {
    if (this.#noRender.value) return
    super.play()
  }

  refresh(): void {
    this.ticker.update()
  }

  async withoutRendering(fn: () => Promise<void>): Promise<void> {
    this.#noRender.value++
    await fn().finally(() => this.#noRender.value--)
  }

  importFromJson(content: Schema.SerializedMovie): void {
    this.resolution = content.resolution
    this.frameRate = content.frameRate

    content.assets.forEach((init) => this.createAsset(init))

    const createChildren = (parent: AnyNode, childrenInit: Schema.AnyNodeSerializedSchema[]): void => {
      childrenInit.forEach((childInit, index) => {
        const childNode = this.createNode(childInit)
        childNode.position({ parentId: parent.id, index })
        if ('children' in childInit) createChildren(childNode, childInit.children)
      })
    }

    createChildren(this.timeline, content.tracks)
  }
}
