import { createEffectScope, effect, ref } from 'fine-jsx'

import { HTMLElementOrStub } from 'shared/utils/window'
import { renderComponentTo } from 'shared/video/render-to'

import type * as pub from '../../types/webgl-video-editor.ts'
import { VideoEditorUI } from '../components/video-editor-ui.jsx'
import styles from '../css/index.module.css'
import { VideoEditorLocalStore } from '../store/local.ts'
import { VideoEditor } from '../video-editor.ts'

const UNMOUNT_TIMEOUT_MS = 500

export class VideoEditorElement extends HTMLElementOrStub implements pub.VideoEditor {
  static observedAttributes = ['messages', 'languages']

  /** @internal @hidden */
  _editor!: VideoEditor
  get doc(): pub.Document {
    return this._editor.doc
  }

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

  declare _secondsPerPixel: VideoEditor['_secondsPerPixel']
  declare _showStats: VideoEditor['_showStats']
  declare _timelineSize: VideoEditor['_timelineSize']
  declare canvas: VideoEditor['canvas']
  declare currentTime: VideoEditor['currentTime']
  declare effectRenderer: VideoEditor['effectRenderer']
  declare effects: VideoEditor['effects']
  declare exportProgress: VideoEditor['exportProgress']
  declare exportResult: VideoEditor['exportResult']
  declare playback: VideoEditor['playback']
  declare selection: VideoEditor['selection']
  declare state: VideoEditor['state']
  declare store: VideoEditor['store']
  declare tracks: VideoEditor['tracks']
  declare viewportSize: VideoEditor['viewportSize']
  declare zoom: VideoEditor['zoom']
  declare secondsToPixels: VideoEditor['secondsToPixels']
  declare pixelsToSeconds: VideoEditor['pixelsToSeconds']
  declare select: VideoEditor['select']
  declare seekTo: VideoEditor['seekTo']
  declare addTrack: VideoEditor['addTrack']
  declare addClip: VideoEditor['addClip']
  declare replaceClipAsset: VideoEditor['replaceClipAsset']
  declare createMediaAsset: VideoEditor['createMediaAsset']
  declare splitClipAtCurrentTime: VideoEditor['splitClipAtCurrentTime']
  declare deleteSelection: VideoEditor['deleteSelection']
  declare importJson: VideoEditor['importJson']
  declare export: VideoEditor['export']
  declare toObject: VideoEditor['toObject']

  constructor() {
    super()

    this.classList.add(styles.host)

    this.#scope.run(() => {
      this._editor = new VideoEditor({ store: new VideoEditorLocalStore() })

      effect(() => {
        const state = this._editor.toObject()
        this.#dispatch('change', state)
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
          onError: (error: unknown) => this.#dispatch('error', error),
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

  #dispatch(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  dispose() {
    this._editor.dispose()
    this.#scope.stop()
  }
}

for (const key of [
  '_secondsPerPixel',
  '_showStats',
  '_timelineSize',
  'canvas',
  'currentTime',
  'effectRenderer',
  'effects',
  'exportProgress',
  'exportResult',
  'playback',
  'selection',
  'state',
  'store',
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
  'toObject',
] satisfies (keyof pub.VideoEditor)[])
  VideoEditorElement.prototype[key] = function (...args: any[]): any {
    const editor = this._editor
    return editor[key](
      // @ts-expect-error -- ts(2556)
      ...args,
    )
  }
