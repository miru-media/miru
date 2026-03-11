/* eslint-disable @typescript-eslint/class-methods-use-this -- matching interface */
import type { AssetLoader, Schema } from '#core'

export class HttpAssetLoader implements AssetLoader {
  canLoad(asset: Schema.MediaAsset): boolean {
    if (!asset.uri) return false
    const { protocol } = new URL(asset.uri)

    return /^https?/u.test(protocol)
  }
  async load(
    asset: Schema.MediaAsset,
    options?: RequestInit,
  ): Promise<{ stream: ReadableStream<Uint8Array>; size?: number }> {
    const res = await fetch(asset.uri!, options)
    const { body } = res

    if (!res.ok || !body) throw new Error('[webgl-video-editor] Asset loader fetch failed.')

    let size: number | undefined
    const contentLength = res.headers.get('content-length')

    if (contentLength) {
      const parsed = parseInt(contentLength, 10)
      size = isNaN(parsed) ? undefined : parsed
    }

    size ??= asset.size

    return { stream: body, size }
  }
}
