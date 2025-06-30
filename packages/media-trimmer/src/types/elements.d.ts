import { type TrimState } from './media-trimmer'
import { HTMLElementOrStub } from "./utils"

export declare class MediaTrimmerElement extends HTMLElementOrStub {
  get source(): string
  set source(value: string)
  get state(): TrimState | undefined
  set state(value: TrimState | undefined)
  attributeChangedCallback(name: 'start' | 'end', _oldValue: number, newValue: number): void
  attributeChangedCallback(name: 'mute', _oldValue: boolean, newValue: boolean): void
  attributeChangedCallback(name: 'source', _oldValue: string, newValue: string): void
  connectedCallback(): void
  disconnectedCallback(): void
  toBlob(): Promise<Blob>
}
