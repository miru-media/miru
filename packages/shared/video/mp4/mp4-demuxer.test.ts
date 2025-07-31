import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import sampleUrl from 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
import { expect, test, vi } from 'vitest'

import type { MediaContainerMetadata } from '../types.ts'

import { MP4Demuxer } from './mp4-demuxer.ts'

test('MP4Demuxer', async () => {
  const demuxer = new MP4Demuxer()

  const stream = Readable.toWeb(
    fs.createReadStream(path.join(process.cwd(), sampleUrl)),
  ) as ReadableStream<Uint8Array>

  const metadata = await demuxer.init(stream)

  expect(metadata).toEqual<MediaContainerMetadata>({
    duration: 596.4733333333334,
    type: 'mp4',
    audio: {
      codec: 'mp4a.40.2',
      duration: 596.4741950113379,
      id: 1,
      numberOfChannels: 2,
      sampleRate: 44100,
      track: expect.any(Object),
      type: 'audio',
    },
    video: {
      codec: 'avc1.64001f',
      codedHeight: 720,
      codedWidth: 1280,
      description: expect.any(Uint8Array),
      duration: 596.4583333333334,
      fps: 24,
      id: 2,
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      rotation: 0,
      track: expect.any(Object),
      type: 'video',
    },
  })

  const videoStream = demuxer.getChunkStream(metadata.video!)
  const audioStream = demuxer.getChunkStream(metadata.audio!)

  expect(videoStream).toEqual(expect.any(ReadableStream))
  expect(audioStream).toEqual(expect.any(ReadableStream))

  demuxer.start()

  const videoWriteCallback = vi.fn()
  const audioWriteCallback = vi.fn()
  const videoOut = new WritableStream<unknown>({ write: videoWriteCallback })
  const audioOut = new WritableStream<unknown>({ write: audioWriteCallback })

  await Promise.all([videoStream.pipeTo(videoOut), audioStream.pipeTo(audioOut)])

  expect(videoWriteCallback).toHaveBeenCalled()
  expect(audioWriteCallback).toHaveBeenCalled()
})
