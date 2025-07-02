import { createEffectScope, effect, ref } from 'fine-jsx'

import { HTMLElementOrStub } from 'shared/utils/window'
import { renderComponentTo } from 'shared/video/render-to'

import type * as schema from '../../types/schema'
import type * as pub from '../../types/webgl-video-editor'
import { VideoEditorUI } from '../components/video-editor-ui'
import type * as nodes from '../nodes'
import { VideoEditor } from '../video-eidtor'

const UNMOUNT_TIMEOUT_MS = 500

export class VideoEditorElement extends HTMLElementOrStub implements pub.VideoEditor {
  static observedAttributes = ['messages', 'languages']

  editor!: VideoEditor
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
    return this.editor.renderer
  }
  get canvas() {
    return this.editor.canvas
  }
  get resolution() {
    return this.editor._movie.resolution
  }
  set resolution(value) {
    this.editor._movie.resolution = value
  }
  get frameRate() {
    return this.editor._movie.frameRate.value
  }
  set frameRate(value) {
    this.editor._movie.frameRate.value = value
  }
  get isEmpty() {
    return this.editor._movie.isEmpty
  }
  get isPaused() {
    return this.editor._movie.isEmpty
  }
  get currentTime() {
    return this.editor.currentTime
  }
  get effects() {
    return this.editor.effects
  }

  get tracks(): pub.Track[] {
    return this.editor.tracks
  }
  get selection(): pub.Clip | undefined {
    return this.editor.selection
  }
  get isLoading() {
    return this.editor.isLoading
  }
  get canUndo() {
    return this.editor.canUndo
  }
  get canRedo() {
    return this.editor.canRedo
  }
  get exportResult() {
    return this.editor.exportResult
  }

  get state() {
    return this.toObject()
  }

  constructor() {
    super()

    this.#scope.run(() => {
      this.editor = new VideoEditor()

      effect(() => {
        const state = this.editor.toObject()
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
          editor: this.editor,
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
    this.editor.play()
  }
  pause() {
    this.editor.pause()
  }
  seekTo(time: number) {
    this.editor.seekTo(time)
  }
  async addClip(track: pub.Track, source: string | Blob) {
    return await this.editor.addClip(track as nodes.Track<nodes.Clip>, source)
  }
  selectClip(clip: pub.Clip | undefined) {
    this.editor.selectClip(clip?.id)
  }
  async createMediaAsset(source: string | Blob) {
    return await this.editor.createMediaAsset(source)
  }
  splitClipAtCurrentTime(): pub.Clip | undefined {
    return this.editor.splitClipAtCurrentTime()
  }
  undo() {
    this.editor.undo()
  }
  redo() {
    this.editor.redo()
  }
  async replaceClipSource(source: Blob | string) {
    await this.editor.replaceClipSource(source)
  }
  setClipFilter(clip: pub.Clip, filterId: string | undefined, intensity: number): void {
    this.editor.setClipFilter(this.editor._movie.nodes.get(clip.id), filterId, intensity)
  }
  deleteSelection() {
    this.editor.deleteSelection()
  }
  async clearAllContentAndHistory() {
    await this.editor.clearAllContentAndHistory()
  }
  async replaceContent(newContent: schema.Movie) {
    await this.editor.replaceContent(newContent)
  }
  toObject() {
    return this.editor.toObject()
  }
  async export() {
    return await this.editor.export()
  }

  #dispatch(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  dispose() {
    this.editor.dispose()
    this.#scope.stop()
  }
}
