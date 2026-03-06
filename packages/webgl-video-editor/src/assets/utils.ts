import * as Mb from 'mediabunny'

import type * as Schema from '../../types/schema'

export const getMediaAssetInfo = async (
  id: string,
  source: string | Blob | File,
  requestInit?: RequestInit,
): Promise<Schema.MediaAsset> => {
  const isBlobSource = typeof source !== 'string'
  let mimeType = isBlobSource ? source.type : ''
  const name = isBlobSource ? ('name' in source ? source.name : undefined) : source.replace(/.*\//, '')

  let mbSource: Mb.Source
  let size: number

  if (isBlobSource) {
    mbSource = new Mb.BlobSource(source)
    ;({ size } = source)
  } else {
    try {
      const res = await fetch(source, requestInit)
      const { body } = res
      if (!res.ok || !body) throw new Error('Fetch failed')

      mimeType ||= res.headers.get('content-type') ?? ''

      const contentLength = res.headers.get('content-length')
      if (contentLength) {
        size = parseInt(contentLength, 10)
        mbSource = new Mb.UrlSource(source)
      } else {
        const blob = await res.blob()
        mbSource = new Mb.BlobSource(blob)
        ;({ size } = blob)
      }
    } catch (error) {
      throw new Error(`[webgl-video-editor] Failed to fetch asset from "${source}".`, { cause: error })
    }
  }

  const input = new Mb.Input({
    formats: Mb.ALL_FORMATS,
    source: mbSource,
  })

  const video = await input.getPrimaryVideoTrack()
  const audio = await input.getPrimaryAudioTrack()

  if (video?.codec === null) throw new Error(`[webgl-video-editor] Couldn't get media video codec.`)
  if (audio?.codec === null) throw new Error(`[webgl-audio-editor] Couldn't get media audio codec.`)

  return {
    id,
    type: 'asset:media:av',
    mimeType: await input.getMimeType(),
    name,
    size,
    audio: audio
      ? {
          codec: audio.codec,
          duration: await audio.computeDuration(),
          numberOfChannels: audio.numberOfChannels,
          sampleRate: audio.sampleRate,
          firstTimestamp: await audio.getFirstTimestamp(),
        }
      : undefined,
    video: video
      ? {
          codec: video.codec,
          duration: await video.computeDuration(),
          rotation: video.rotation,
          width: video.codedWidth,
          height: video.codedHeight,
          frameRate: (await video.computePacketStats()).averagePacketRate,
          firstTimestamp: await video.getFirstTimestamp(),
        }
      : undefined,
    duration: await input.computeDuration(),
    uri: isBlobSource ? undefined : source,
  }
}
