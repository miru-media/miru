import { createEffectScope, ref } from 'fine-jsx'

import { HTMLElementOrStub } from 'shared/utils'
import { renderComponentTo } from 'shared/video/render-to'

import { trim } from '../trim.ts'
import type { LoadInfo, TrimState } from '../types/ui.ts'
import { VideoTrimmerUI } from '../video-trimmer-ui.jsx'

const OBSERVED_ATTRS = ['source', 'start', 'end', 'mute'] as const
const UNMOUNT_TIMEOUT_MS = 500

export class MediaTrimmerElement extends HTMLElementOrStub {
  static observedAttributes = OBSERVED_ATTRS

  readonly #scope = createEffectScope()
  readonly #source = ref<string | Blob>()
  readonly #state = ref<TrimState>({ start: 0, end: 0, mute: false })
  #unmount?: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  #isTrimming = false
  #mediaInfo?: LoadInfo

  get source(): string | Blob | undefined {
    return this.#source.value
  }
  set source(value: string | Blob | undefined) {
    this.#source.value = value
  }

  get start(): number {
    return this.#state.value.start
  }
  set start(value: number) {
    this.#state.value = { ...this.#state.value, start: value }
  }

  get end(): number {
    return this.#state.value.end
  }
  set end(value: number) {
    this.#state.value = { ...this.#state.value, end: value }
  }

  get mute(): boolean {
    return this.#state.value.mute
  }
  set mute(value: boolean) {
    this.#state.value = { ...this.#state.value, mute: value }
  }

  attributeChangedCallback(name: 'start' | 'end', _oldValue: number, newValue: number): void
  attributeChangedCallback(name: 'mute', _oldValue: boolean, newValue: boolean): void
  attributeChangedCallback(name: 'source', _oldValue: string, newValue: string): void
  attributeChangedCallback(name: (typeof OBSERVED_ATTRS)[number], _oldValue: any, newValue: any): void {
    ;(this as any)[name] = newValue
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
          onLoad: this.#onLoad.bind(this),
          onChange: this.#onChange.bind(this),
          onError: this.#onError.bind(this),
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

  async toBlob() {
    const { source, start, end, mute } = this

    if (this.#isTrimming) throw new Error('[media-trimmer] Trim is already in progress.')
    if (source == null || source === '') throw new Error(`[media-trimmer]: Source media wasn't set.`)
    if (!this.#mediaInfo) throw new Error(`[media-trimmer] Source isn't ready yet`)

    this.#isTrimming = true
    const { duration, hasAudio } = this.#mediaInfo

    try {
      if (start === 0 && end === duration && (!hasAudio || !mute))
        return typeof source === 'string' ? await fetch(source).then((res) => res.blob()) : source

      return await trim(source, {
        start,
        end,
        mute,
        onProgress: (progress) => this.#dispatch('progress', { progress }),
      })
    } finally {
      this.#isTrimming = false
    }
  }

  #onLoad(info: LoadInfo) {
    this.#mediaInfo = info
    this.#dispatch('load', info)
  }
  #onChange(state: TrimState) {
    this.#state.value = state
    this.#dispatch('change', state)
  }
  #onError(error: unknown) {
    this.#dispatch('error', new ErrorEvent('error', { error }))
  }

  #dispatch(type: string, detail: unknown) {
    if (type === 'load') this.#mediaInfo = detail as LoadInfo
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }
}
