import { createEffectScope, effect, ref } from 'fine-jsx'
import type { Effect } from 'webgl-effects'

import { HTMLElementOrStub } from 'shared/utils/window'
import { renderComponentTo } from 'shared/video/render-to'

import type * as schema from '../../types/schema.ts'
import type * as pub from '../../types/webgl-video-editor.ts'
import { VideoEditorUI } from '../components/video-editor-ui.jsx'
import type * as nodes from '../nodes/index.ts'
import { VideoEditorLocalStore } from '../store/local.ts'
import { VideoEditor } from '../video-editor.ts'

const UNMOUNT_TIMEOUT_MS = 500

export class VideoEditorElement extends HTMLElementOrStub implements pub.VideoEditor {
  static observedAttributes = ['messages', 'languages']

  /** @internal @hidden */
  _editor!: VideoEditor

  readonly #scope = createEffectScope()
  #unmount?: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  readonly #messages = ref<Record<string, Record<string, string>>>({})
  readonly #languages = ref(navigator.languages.slice(0))

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

  get renderer() {
    return this._editor.renderer
  }
  get canvas() {
    return this._editor.canvas
  }
  get resolution() {
    return this._editor._movie.resolution
  }
  set resolution(value) {
    this._editor._movie.resolution = value
  }
  get frameRate() {
    return this._editor._movie.frameRate
  }
  set frameRate(value) {
    this._editor._movie.frameRate = value
  }
  get isEmpty() {
    return this._editor._movie.isEmpty
  }
  get isPaused() {
    return this._editor._movie.isEmpty
  }
  get currentTime() {
    return this._editor.currentTime
  }
  get effects(): Map<string, Effect> {
    return this._editor.effects as any
  }

  get tracks(): pub.Track[] {
    return this._editor.tracks
  }
  get selection(): pub.Clip | undefined {
    return this._editor.selection
  }
  get isLoading() {
    return this._editor.isLoading
  }
  get exportResult() {
    return this._editor.exportResult
  }

  get state() {
    return this.toObject()
  }

  constructor() {
    super()

    this.#scope.run(() => {
      this._editor = new VideoEditor({ store: new VideoEditorLocalStore() })

      effect(() => {
        const state = this._editor.toObject()
        this.#dispatch('change', state)
      })

      effect(() => this.#dispatch('changeloading', this.isLoading))
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

  play() {
    this._editor.play()
  }
  pause() {
    this._editor.pause()
  }
  seekTo(time: number) {
    this._editor.seekTo(time)
  }
  async addClip(track: pub.Track, source: string | Blob | pub.Schema.Clip): Promise<pub.Clip> {
    return await this._editor.addClip(track as nodes.Track, source)
  }
  selectClip(clip: pub.Clip | undefined) {
    this._editor.selectClip(clip?.id)
  }
  async createMediaAsset(source: string | Blob) {
    return await this._editor.createMediaAsset(source)
  }
  splitClipAtCurrentTime(): pub.Clip | undefined {
    return this._editor.splitClipAtCurrentTime()
  }
  async replaceClipSource(source: Blob | string) {
    await this._editor.replaceClipSource(source)
  }
  deleteSelection() {
    this._editor.deleteSelection()
  }
  async clearAllContentAndHistory() {
    await this._editor.clearAllContentAndHistory()
  }
  replaceContent(newContent: schema.SerializedMovie): void {
    this._editor.replaceContent(newContent)
  }
  toObject() {
    return this._editor.toObject()
  }
  async export() {
    return await this._editor.export()
  }

  #dispatch(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  dispose() {
    this._editor.dispose()
    this.#scope.stop()
  }
}
