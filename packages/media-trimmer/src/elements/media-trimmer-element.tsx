import { createEffectScope, ref } from 'fine-jsx'

import { HTMLElementOrStub } from 'shared/utils'
import { renderComponentTo } from 'shared/video/render-to'

import { trim } from '../trim'
import { type TrimState } from '../types/ui'
import { VideoTrimmerUI } from '../video-trimmer-ui'

const OBSERVED_ATTRS = ['source', 'start', 'end', 'mute'] as const

export class MediaTrimmerElement extends HTMLElementOrStub {
  static observedAttributes = OBSERVED_ATTRS

  #scope = createEffectScope()
  #source = ref<string>('')
  #state = ref<TrimState>()
  #unmount?: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  #isTrimming = false

  get source() {
    return this.#source.value
  }
  set source(value: string) {
    this.#source.value = value
  }

  get state() {
    return this.#state.value
  }
  set state(value: TrimState | undefined) {
    this.#state.value = value
  }

  attributeChangedCallback(name: 'start' | 'end', _oldValue: number, newValue: number): void
  attributeChangedCallback(name: 'mute', _oldValue: boolean, newValue: boolean): void
  attributeChangedCallback(name: 'source', _oldValue: string, newValue: string): void
  attributeChangedCallback(name: string, _oldValue: any, newValue: any): void {
    if (name === 'start' || name === 'end' || name === 'mute')
      this.state = { start: 0, end: 0, mute: false, ...this.state, [name]: newValue }
    else if (name === 'source') this[name] = newValue
  }

  connectedCallback() {
    clearTimeout(this.#disconnectTimeout)
    if (this.#unmount) return

    this.#unmount = this.#scope.run(() =>
      renderComponentTo(
        VideoTrimmerUI,
        {
          source: this.#source,
          state: this.#state,
          onChange: (value) => this.#dispatch('change', value),
          onError: (error) => this.#dispatch('error', error),
          onLoad: (info) => this.#dispatch('load', info),
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

  async toBlob() {
    const { state, source } = this
    if (this.#isTrimming) throw new Error('[media-trimmer] Trim is already in progress.')
    if (!source) throw new Error(`[media-trimmer]: Can't export without source.`)

    this.#isTrimming = true

    if (!state || state.isFullDuration) return await fetch(source).then((res) => res.blob())

    return await trim(source, {
      ...state,
      onProgress: (progress) => this.#dispatch('progress', { progress }),
    }).finally(() => (this.#isTrimming = false))
  }

  #dispatch(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }
}
