export declare class MediaTrimmerElement extends HTMLElement {
  get source(): string
  set source(value: string | Blob | undefined)
  get start(): number
  set start(value: number)
  get end(): number
  set end(value: number)
  get mute(): boolean
  set mute(value: boolean)
  toBlob(): Promise<Blob>
}
