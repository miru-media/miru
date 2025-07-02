/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-extraneous-class -- -- */
import type { VideoEditor } from './core'

export interface VideoEditorElement extends HTMLElement, VideoEditor {
  editor: VideoEditor
  messages: Record<string, Record<string, string>>
  languages: () => string[]
}

export declare class VideoEditorElement {}
