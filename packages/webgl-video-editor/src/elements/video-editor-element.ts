import { createEffectScope, ref } from 'fine-jsx'

import { HTMLElementOrStub } from 'shared/utils/window'
import { renderComponentTo } from 'shared/video/render-to'

import type * as pub from '../../types/webgl-video-editor.ts'
import { VideoEditorUI } from '../components/video-editor-ui.jsx'
import styles from '../css/index.module.css'
import { LocalSync } from '../sync/index.ts'
import { VideoEditor } from '../video-editor.ts'

const UNMOUNT_TIMEOUT_MS = 500

export class VideoEditorElement extends HTMLElementOrStub implements pub.VideoEditor {
  static observedAttributes = ['messages', 'languages']

  /** @internal */
  _editor!: VideoEditor

  readonly #scope = createEffectScope()
  #unmount?: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  readonly #messages = ref<Record<string, Record<string, string>>>({})
  readonly #languages = ref(navigator.languages.slice(0))
  readonly #slots = { default: ref<Node[]>(), timelineEmpty: ref<Node[]>() }

  get messages() {
    return this.#messages.value
  }
  set messages(value) {
    this.#messages.value = value
  }
  get languages() {
    return this.#languages.value
  }
  set languages(value) {
    this.#languages.value = value
  }

  declare readonly doc: pub.VideoEditor['doc']
  declare readonly _secondsPerPixel: pub.VideoEditor['_secondsPerPixel']
  declare readonly _showStats: pub.VideoEditor['_showStats']
  declare readonly canvas: pub.VideoEditor['canvas']
  declare readonly currentTime: pub.VideoEditor['currentTime']
  declare readonly effectRenderer: pub.VideoEditor['effectRenderer']
  declare readonly effects: pub.VideoEditor['effects']
  declare readonly exportProgress: pub.VideoEditor['exportProgress']
  declare readonly exportResult: pub.VideoEditor['exportResult']
  declare readonly playback: pub.VideoEditor['playback']
  declare readonly selection: pub.VideoEditor['selection']
  declare readonly sync: pub.VideoEditor['sync']
  declare readonly tracks: pub.VideoEditor['tracks']
  declare readonly viewportSize: pub.VideoEditor['viewportSize']
  declare readonly zoom: pub.VideoEditor['zoom']

  declare secondsToPixels: pub.VideoEditor['secondsToPixels']
  declare pixelsToSeconds: pub.VideoEditor['pixelsToSeconds']
  declare select: pub.VideoEditor['select']
  declare seekTo: pub.VideoEditor['seekTo']
  declare addTrack: pub.VideoEditor['addTrack']
  declare addClip: pub.VideoEditor['addClip']
  declare replaceClipAsset: pub.VideoEditor['replaceClipAsset']
  declare createMediaAsset: pub.VideoEditor['createMediaAsset']
  declare splitClipAtCurrentTime: pub.VideoEditor['splitClipAtCurrentTime']
  declare deleteSelection: pub.VideoEditor['deleteSelection']
  declare importJson: pub.VideoEditor['importJson']
  declare export: pub.VideoEditor['export']
  declare generateId: pub.VideoEditor['generateId']

  constructor() {
    super()

    this.classList.add(styles.host)

    this.#scope.run(() => {
      this._editor = new VideoEditor({ sync: new LocalSync() })

      const dispatchEvent = this.dispatchEvent.bind(this)
      ;(
        [
          'error',

          'doc:dispose',
          'settings:update',

          'node:create',
          'node:move',
          'node:update',
          'node:delete',

          'asset:create',
          'asset:delete',

          'playback:play',
          'playback:pause',
          'playback:update',
          'playback:seek',

          'canvas:click',
          'canvas:pointerdown',
          'canvas:pointermove',
          'canvas:pointerup',
        ] satisfies (keyof pub.VideoEditorEvents)[]
      ).forEach((type) => {
        this.doc.on(type, dispatchEvent)
      })
    })
  }

  connectedCallback() {
    clearTimeout(this.#disconnectTimeout)
    if (this.#unmount) return

    this.#unmount = this.#scope.run(() =>
      renderComponentTo(
        VideoEditorUI,
        {
          editor: this._editor,
          children: this.#slots,
          i18n: { messages: this.#messages, languages: this.#languages },
          onError: (error: unknown) => this.dispatchEvent(new ErrorEvent('error', { error })),
        },
        this,
      ),
    )
  }

  disconnectedCallback() {
    this.#disconnectTimeout = setTimeout(() => {
      this.#unmount?.()
      this.#unmount = undefined
    }, UNMOUNT_TIMEOUT_MS)
  }

  attributeChangedCallback(name: 'messages' | 'languages', _oldValue: string, newValue: string): void {
    this[name] = JSON.parse(newValue)
  }

  slotContent(name: 'default' | 'timelineEmpty', nodes: Node[] | undefined) {
    this.#slots[name].value = nodes
  }

  dispose() {
    this._editor.dispose()
    this.#scope.stop()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}

for (const key of [
  '_secondsPerPixel',
  '_showStats',
  'canvas',
  'currentTime',
  'effectRenderer',
  'effects',
  'exportProgress',
  'exportResult',
  'playback',
  'selection',
  'sync',
  'tracks',
  'viewportSize',
  'zoom',
] satisfies (keyof pub.VideoEditor)[])
  Object.defineProperty(VideoEditorElement.prototype, key, {
    get(this: VideoEditorElement) {
      return this._editor[key]
    },
    enumerable: true,
  })

for (const key of [
  'secondsToPixels',
  'pixelsToSeconds',
  'select',
  'seekTo',
  'addTrack',
  'addClip',
  'replaceClipAsset',
  'createMediaAsset',
  'splitClipAtCurrentTime',
  'deleteSelection',
  'importJson',
  'export',
  'generateId',
] satisfies (keyof pub.VideoEditor)[])
  VideoEditorElement.prototype[key] = function (...args: any[]): any {
    const editor = this._editor
    return editor[key](
      // @ts-expect-error -- ts(2556)
      ...args,
    )
  }
