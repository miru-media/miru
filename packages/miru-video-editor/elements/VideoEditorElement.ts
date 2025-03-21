import { createEffectScope, effect, ref } from 'fine-jsx'

import { HTMLElement } from 'shared/utils/window'

import { renderComponentTo } from '../components/renderTo'
import { VideoEditorUI } from '../components/VideoEditorUI'
import type * as nodes from '../nodes'
import type * as schema from '../nodes/schema'
import type * as pub from '../typings'
import { VideoEditor } from '../VideoEditor'

export class VideoEditorElement extends HTMLElement implements pub.VideoEditor {
  static observedAttributes = ['messages', 'languages']

  editor!: VideoEditor
  #scope = createEffectScope()
  #unmount?: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  #messages = ref<Record<string, Record<string, string>>>({})
  #languages = ref(navigator.languages.slice(0))

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

  get tracks(): pub.Track[] {
    return this.editor._movie.children
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
    }, 500)
  }

  attributeChangedCallback(name: 'messages' | 'languages', _oldValue: string, newValue: string): void {
    this[name] = JSON.parse(newValue)
  }

  seekTo(time: number) {
    this.editor.seekTo(time)
  }
  addClip(track: pub.Track, source: string | Blob) {
    return this.editor.addClip(track as nodes.Track<nodes.Clip>, source)
  }
  selectClip(clip: pub.Clip) {
    this.editor.selectClip(clip.id)
  }
  createMediaAsset(source: string | Blob) {
    return this.editor.createMediaAsset(source)
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
  clearAllContentAndHistory() {
    return this.editor.clearAllContentAndHistory()
  }
  replaceContent(newContent: schema.Movie) {
    return this.editor.replaceContent(newContent)
  }
  toObject() {
    return this.editor.toObject()
  }
  export() {
    return this.editor.export()
  }

  #dispatch(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  dispose() {
    this.editor.dispose()
    this.#scope.stop()
  }
}
