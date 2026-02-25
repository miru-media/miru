import { effect, type Ref, ref, watch } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import { IS_FIREFOX } from 'shared/userAgent.ts'
import { whenLoadedMetadata } from 'shared/utils/images.ts'

import type { Schema } from '../../types/core'
import type * as pub from '../../types/core.d.ts'
import type { RootNode } from '../../types/internal'
import type { VideoEffectAsset } from '../assets.ts'
import { CanvasEvent } from '../events.ts'
import { MiruFilter } from '../pixi/pixi-miru-filter.ts'
import { updateSpriteTransform } from '../utils.ts'

import { Clip } from './clip.ts'

interface Point {
  x: number
  y: number
}
const pointsAreEqual = (a?: Point, b?: Point): boolean =>
  (!a && !b) || (!!a && !!b && a.x === b.x && a.y === b.y)

export class VisualClip extends Clip<Schema.VisualClip> implements pub.VisualClip {
  declare clipType: 'video'
  declare container: Pixi.Sprite
  get sprite(): Pixi.Sprite {
    return this.container
  }

  declare position: { x: number; y: number }
  declare rotation: number
  declare scale: { x: number; y: number }

  declare filter: Schema.VisualClip['filter']
  declare _pixiFilters: MiruFilter[]

  declare _filter: Ref<VideoEffectAsset | undefined>
  declare _filterIntensity: Ref<number>

  get isReady(): boolean {
    return super.isReady && !this._filter.value?.isLoading
  }

  get videoRotation(): number {
    if (IS_FIREFOX) return this.sourceAsset.video?.rotation ?? 0
    return 0
  }

  constructor(init: Schema.VisualClip, root: RootNode) {
    super(init, root)

    this.scope.run(() => {
      effect(this._onChangeTransform.bind(this))

      watch([this.media], ([mediaElement], _, onCleanup) => {
        let isStale = false
        onCleanup(() => (isStale = true))

        void whenLoadedMetadata(mediaElement).then(() => {
          if (isStale) return

          const { texture } = this.sprite
          texture.source = new Pixi.ImageSource({ resource: mediaElement as HTMLVideoElement })
          texture.update()
        })
      })
    })

    this.onDispose(this.#onDispose.bind(this))
  }

  protected _init(init: Schema.VisualClip): void {
    super._init(init)

    this.container = new Pixi.Sprite({
      texture: new Pixi.Texture({ source: new Pixi.ImageSource(this.mediaSize) }),
      visible: true,
      eventMode: 'static',
      zIndex: this.index,
    })
    this._filter = ref<VideoEffectAsset>()
    this._filterIntensity = ref(1)
    this._pixiFilters = []

    const reactivePointOptions = {
      equal: pointsAreEqual,
    }
    this._defineReactive('position', init.position, { ...reactivePointOptions, defaultValue: { x: 0, y: 0 } })
    this._defineReactive('rotation', init.rotation, { defaultValue: 0 })
    this._defineReactive('scale', init.scale, { ...reactivePointOptions, defaultValue: { x: 1, y: 1 } })

    this._defineReactive('filter', init.filter, {
      onChange: (value) => {
        this._filterIntensity.value = value?.intensity ?? 1

        if (value?.assetId === this._filter.value?.id) return

        this._pixiFilters.forEach((filter) => filter.destroy())
        this._pixiFilters.length = 0

        this._filter.value = value ? (this.root.assets.get(value.assetId) as VideoEffectAsset) : undefined

        this.container.filters = this._pixiFilters =
          this._filter.value?.raw.ops.map((op) => new MiruFilter(op, this._filterIntensity)) ?? []

        this._pixiFilters.forEach((filter) =>
          filter.sprites.forEach((sprite) => this.root.stage.addChild(sprite)),
        )
      },
      equal: (a, b) => (!a && !b) || (!!a && !!b && a.assetId === b.assetId && a.intensity === b.intensity),
    })

    this.sprite.on('pointerdown', (event) => {
      this.root._emit(new CanvasEvent('pointerdown', this))
      event.stopPropagation()
    })
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- --
  isVisual(): this is VisualClip {
    return true
  }

  _onChangeTransform() {
    updateSpriteTransform(this)
  }

  resizeSprite(): void {
    updateSpriteTransform(this)
  }

  toObject(): Schema.VisualClip {
    const { position, rotation, scale, filter } = this
    const obj: Schema.VisualClip = super.toObject()

    if (position.x !== 0 || position.y !== 0) obj.position = position
    if (rotation !== 0) obj.rotation = rotation
    if (scale.x !== 1 || scale.y !== 1) obj.scale = scale
    if (filter) obj.filter = { assetId: filter.assetId, intensity: filter.intensity }

    return obj
  }

  #onDispose() {
    this._pixiFilters.forEach((filter) => filter.sprites.forEach((sprite) => sprite.removeFromParent()))
  }
}
