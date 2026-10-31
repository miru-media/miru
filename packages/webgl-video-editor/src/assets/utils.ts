import type * as Mb from 'mediabunny'

import { CLIP_COLORS } from '#constants'
import type * as Schema from '#schema'
import {
  blobToDataUrl,
  canvasToDataUrl,
  fit,
  get2dContext,
  loadAsyncImageSource,
  Rational,
  resizeImageSync,
  stringHashCode,
} from 'shared/utils/index.ts'
import { FileSignature } from 'shared/video/file-signature'

const ASSET_THUMBNAIL_SIZE = 320

const getAudioCoverArtDataUrl = async (input: Mb.Input): Promise<string | undefined> => {
  const tags = await input.getMetadataTags()
  const cover = tags.images?.find((img) => img.kind === 'coverFront') ?? tags.images?.[0]
  return cover && (await blobToDataUrl(new Blob([cover.data.slice().buffer], { type: cover.mimeType })))
}

const getVideoThumbnailDataUrl = async (videoTrack: Mb.InputVideoTrack): Promise<string | undefined> => {
  const { CanvasSink } = await import('mediabunny')
  const sink = new CanvasSink(videoTrack, {
    width: ASSET_THUMBNAIL_SIZE,
    height: ASSET_THUMBNAIL_SIZE,
    fit: 'cover',
  })
  const timestamp = await videoTrack.getFirstTimestamp()
  const wrappedCanvas = await sink.getCanvas(timestamp)
  if (!wrappedCanvas) return

  return await canvasToDataUrl(wrappedCanvas.canvas, { type: 'image/jpeg', quality: 0.7 })
}

/* eslint-disable  @typescript-eslint/no-magic-numbers -- file signature magic numbers */
const JPEG = new FileSignature('image/jpeg', 0, new Uint8Array([0xff, 0xd8, 0xff]))
const PNG = new FileSignature(
  'image/png',
  0,
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
)

/* eslint-enable  @typescript-eslint/no-magic-numbers */

export const getMediaAssetInfo = async (
  id: string,
  _source: string | Blob | File,
  requestInit?: RequestInit,
): Promise<Schema.MediaAsset | Schema.ImageAsset> => {
  const isBlobSource = typeof _source !== 'string'
  let mimeType = isBlobSource ? _source.type : ''
  const name = isBlobSource ? ('name' in _source ? _source.name : undefined) : _source

  let source = _source
  let size: number
  let streamForSignature

  if (isBlobSource) {
    ;({ size } = _source)
    streamForSignature = _source.stream()
  } else {
    try {
      const res = await fetch(_source, requestInit)
      const { body } = res
      if (!res.ok || !body) throw new Error('Fetch failed')

      mimeType ||= res.headers.get('content-type') ?? ''

      const contentLength = parseInt(res.headers.get('content-length') ?? '', 10)

      if (res.body && contentLength) {
        size = contentLength
        streamForSignature = res.body
      } else {
        const blob = await res.blob()
        source = blob
        ;({ size } = blob)
        streamForSignature = blob.stream()
      }
    } catch (error) {
      throw new Error(`[webgl-video-editor] Failed to fetch asset from "${_source}".`, { cause: error })
    }
  }

  const reader = streamForSignature.getReader()
  const { value: fileBytes } = await reader.read()
  reader.cancel().catch(() => undefined)

  const imageType = fileBytes && [JPEG, PNG].find((sig) => sig.check(fileBytes))
  if (imageType) {
    const { promise, close } = loadAsyncImageSource(source, undefined, false)
    const image = await promise
    const { width, height } = image
    const context = get2dContext()
    resizeImageSync(
      image,
      undefined,
      fit(image, { width: ASSET_THUMBNAIL_SIZE, height: ASSET_THUMBNAIL_SIZE }),
      context,
    )
    close()

    return {
      id,
      type: 'asset:media:image',
      mimeType: imageType.mimeType,
      size,
      video: {
        width,
        height,
        rotation: 0,
      },
      thumbnailUri: await canvasToDataUrl(context.canvas),
      uri: isBlobSource ? undefined : _source,
    }
  }

  const { BlobSource, UrlSource, Input, ALL_FORMATS } = await import('mediabunny')
  const input = new Input({
    formats: ALL_FORMATS,
    source: typeof source === 'string' ? new UrlSource(source) : new BlobSource(source),
  })

  const [video, audio] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()])
  const [videoCodec, audioCodec] = await Promise.all([video?.getCodec(), audio?.getCodec()])

  if (video && !videoCodec) throw new Error(`[webgl-video-editor] Couldn't get media video codec.`)
  if (audio && !audioCodec) throw new Error(`[webgl-audio-editor] Couldn't get media audio codec.`)

  const thumbnailUri = await (video ? getVideoThumbnailDataUrl(video) : getAudioCoverArtDataUrl(input)).catch(
    () => undefined,
  )

  const _getRational = (timeResolution: number, value: number): Rational =>
    Rational.fromDecimal(value, timeResolution)
  const getVideoRational = video
    ? _getRational.bind(null, await video.getTimeResolution())
    : (undefined as never)
  const getAudioRational = audio
    ? _getRational.bind(null, await audio.getTimeResolution())
    : (undefined as never)

  return {
    id,
    type: 'asset:media:av',
    mimeType: await input.getMimeType(),
    name,
    color: CLIP_COLORS[Math.abs(stringHashCode(id)) % CLIP_COLORS.length],
    size,
    thumbnailUri,
    audio: audio
      ? {
          codec: audioCodec!,
          duration: getAudioRational(await audio.computeDuration()).toJSON(),
          numberOfChannels: await audio.getNumberOfChannels(),
          sampleRate: await audio.getSampleRate(),
          firstTimestamp: getAudioRational(await audio.getFirstTimestamp()).toJSON(),
        }
      : undefined,
    video: video
      ? {
          codec: videoCodec!,
          duration: getVideoRational(await video.computeDuration()).toJSON(),
          rotation: await video.getRotation(),
          width: await video.getCodedWidth(),
          height: await video.getCodedHeight(),
          frameRate: (await video.computePacketStats()).averagePacketRate,
          firstTimestamp: getVideoRational(await video.getFirstTimestamp()).toJSON(),
        }
      : undefined,
    duration: await input.computeDuration(),
    uri: isBlobSource ? undefined : _source,
  }
}
