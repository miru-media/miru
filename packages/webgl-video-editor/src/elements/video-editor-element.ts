import { createEffectScope, effect, ref } from 'fine-jsx'

import { HTMLElementOrStub } from 'shared/utils/window'
import { renderComponentTo } from 'shared/video/render-to'

import type * as pub from '../../types/webgl-video-editor.ts'
import { VideoEditorUI } from '../components/video-editor-ui.jsx'
import styles from '../css/index.module.css'
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

  get effectRenderer() {
    return this._editor.effectRenderer
  }
  get canvas() {
    return this._editor.canvas
  }
  get resolution() {
    return this._editor._doc.resolution
  }
  set resolution(value) {
    this._editor._doc.resolution = value
  }
  get frameRate() {
    return this._editor._doc.frameRate
  }
  set frameRate(value) {
    this._editor._doc.frameRate = value
  }
  get isEmpty() {
    return this._editor._doc.isEmpty
  }
  get isPaused() {
    return this._editor._doc.isEmpty
  }
  get currentTime() {
    return this._editor.currentTime
  }
  get effects(): Map<string, pub.VideoEffectAsset> {
    return this._editor.effects as any
  }

  get tracks(): pub.Track[] {
    return this._editor.tracks
  }
  get selection(): pub.Clip | pub.Gap | undefined {
    return this._editor.selection
  }
  get exportResult() {
    return this._editor.exportResult
  }

  get state() {
    return this.toObject()
  }

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

  play() {
    this._editor.play()
  }
  pause() {
    this._editor.pause()
  }
  seekTo(time: number) {
    this._editor.seekTo(time)
  }
  async addClip(track: pub.Track, source: string | Blob | pub.Schema.BaseClip): Promise<pub.Clip> {
    return await this._editor.addClip(track as nodes.Track, source)
  }
  select(clip: pub.Clip | pub.Gap | undefined) {
    this._editor.select(clip?.id)
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
  importJson(newContent: pub.Schema.SerializedDocument) {
    this._editor.importJson(newContent)
  }
  toObject() {
    return this._editor.toObject()
  }
  async export() {
    return await this._editor.export()
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
