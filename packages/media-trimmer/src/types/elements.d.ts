export declare class MediaTrimmerElement extends HTMLElement {
  get source(): string
  set source(value: string | Blob | undefined)
  get start(): number
  set start(value: number)
  get end(): number
  set end(value: number)
  get mute(): boolean
  set mute(value: boolean)
  readonly duration: number
  readonly hasAudio: boolean
  toBlob(): Promise<Blob>
}

export interface TrimEvent extends Event {
  readonly type: TrimEventType
  readonly target: MediaTrimmerElement
}
