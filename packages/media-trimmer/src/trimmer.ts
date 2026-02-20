import * as Mb from 'mediabunny'

import { Janitor } from 'shared/utils'

import type { TrimOptions } from './types/media-trimmer.ts'
import { assertHasRequiredApis } from './utils.ts'

export class Trimmer {
  source: string | Blob
  options: TrimOptions
  rotation!: number
  janitor?: Janitor
  videoOutCodec!: string

  constructor(source: string | Blob, options: TrimOptions) {
    this.source = source
    this.options = options
  }

  async trim() {
    const { onProgress } = this.options
    onProgress?.(0)
    this.janitor?.dispose()
    const blob = await this._trim().finally(this.dispose.bind(this))
    onProgress?.(1)
    return blob
  }

  async _trim() {
    assertHasRequiredApis()
    const { options, source } = this

    const janitor = (this.janitor = new Janitor())
    const abort = new AbortController()

    let done = false
    janitor.add(() => {
      if (!done && !abort.signal.aborted) abort.abort()
    })

    const input = new Mb.Input({
      formats: Mb.ALL_FORMATS,
      source:
        typeof source === 'string'
          ? new Mb.UrlSource(source, { requestInit: { signal: abort.signal } })
          : new Mb.BlobSource(source),
    })
    const output = new Mb.Output({
      format: new Mb.Mp4OutputFormat(),
      target: new Mb.BufferTarget(),
    })

    const conversion = await Mb.Conversion.init({
      input,
      output,
      audio: { discard: !!options.mute },
      trim: {
        start: options.start,
        end: options.end,
      },
    })

    if (!conversion.isValid) throw new Error('[media-trimmer]: Invalid conversion.')

    conversion.onProgress = this.options.onProgress

    await conversion.execute()

    done = true
    return new Blob([output.target.buffer!])
  }

  dispose() {
    this.janitor?.dispose()
  }
}
