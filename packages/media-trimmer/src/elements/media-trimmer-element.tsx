import { createEffectScope, ref } from 'fine-jsx'

import { HTMLElementOrStub } from 'shared/utils'
import { renderComponentTo } from 'shared/video/render-to'

import { VideoTrimmerUI } from '../components/video-trimmer-ui.jsx'
import styles from '../media-trimmer.module.css'
import { trim } from '../trim.ts'
import type { LoadInfo, TrimState } from '../types/ui.ts'

const OBSERVED_ATTRS = ['source', 'start', 'end', 'mute'] as const
const UNMOUNT_TIMEOUT_MS = 500

export class MediaTrimmerElement extends HTMLElementOrStub {
  static observedAttributes = OBSERVED_ATTRS

  readonly #scope = createEffectScope()
  readonly #source = ref<string | Blob>()
  readonly #state = ref<TrimState>({ start: 0, end: 0, mute: false })
  #unmount?: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  progress = 0
  #isTrimming = false
  duration = 0
  hasAudio = false

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

    this.classList.add(styles.host)

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
    if (!this.duration) throw new Error(`[media-trimmer] Source isn't ready yet`)

    this.#isTrimming = true
    const { duration, hasAudio } = this

    try {
      if (start === 0 && end === duration && (!hasAudio || !mute))
        return typeof source === 'string' ? await fetch(source).then((res) => res.blob()) : source

      return await trim(source, {
        start,
        end,
        mute,
        onProgress: (progress) => {
          this.progress = progress
          this.#dispatch('progress')
        },
      })
    } finally {
      this.#isTrimming = false
      this.progress = 0
    }
  }

  #onLoad(info: LoadInfo) {
    this.duration = info.duration
    this.hasAudio = info.hasAudio
    this.#dispatch('load')
  }
  #onChange(state: TrimState) {
    this.#state.value = state
    this.#dispatch('change')
  }
  #onError(error: unknown) {
    this.dispatchEvent(new ErrorEvent('error', { error }))
  }

  #dispatch(type: TrimEventType) {
    this.dispatchEvent(new TrimEvent(type, this))
  }
}

type TrimEventType = 'change' | 'load' | 'progress'

export class TrimEvent extends Event {
  declare readonly type: TrimEventType
  declare readonly trimmer: MediaTrimmerElement

  constructor(type: TrimEventType, trimmer: MediaTrimmerElement) {
    super(type)
    this.trimmer = trimmer
  }
}
