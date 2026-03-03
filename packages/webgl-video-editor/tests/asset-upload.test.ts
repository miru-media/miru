import { expect, test, vi } from 'vitest'

import type { FileSystemAssetStore } from '#assets'
import type { AssetLoader, Schema } from '#core'

import { Document } from '../src/document.ts'
import type { FileSystemStorage } from '../src/storage/file-system-storage.ts'

const resolution = { width: 100, height: 100 }
const frameRate = 25

const makeTrack = (
  id: string,
  trackType: Schema.SerializedTrack['trackType'],
  children: Schema.SerializedTrack['children'],
): Schema.SerializedTrack => ({
  id,
  type: 'track',
  trackType,
  children,
})

const makeClip = (
  init: Partial<Omit<Schema.SerializedClip, 'id' | 'type' | 'sourceRef'>> & {
    id: string
    sourceRef: Schema.SerializedClip['sourceRef']
  },
): Schema.SerializedClip => ({
  type: 'clip',
  clipType: 'audio',
  duration: 1,
  sourceStart: 0,
  ...init,
})

const makeAvAsset = (id: string, duration: number, uri?: string): Schema.MediaAsset => ({
  id,
  type: 'asset:media:av',
  mimeType: 'video/mp4',
  name: id,
  size: 1,
  duration,
  audio: {
    codec: 'aac',
    duration,
    numberOfChannels: 2,
    sampleRate: 48000,
    firstTimestamp: 0,
  },
  video: {
    codec: 'avc',
    duration,
    rotation: 0,
    width: 1920,
    height: 1080,
    frameRate: 25,
    firstTimestamp: 0,
  },
  uri,
})

vi.mock('../src/storage/file-system-storage.ts', () => {
  const FileSystemStorage = vi.fn(
    class implements Pick<FileSystemStorage, 'create' | 'delete' | 'dispose' | 'hasCompleteFile' | 'get'> {
      get = vi.fn()
      create = vi.fn()
      getOrCreate = vi.fn()
      delete = vi.fn()
      dispose = vi.fn()
      hasCompleteFile = vi.fn()
    },
  )
  return { FileSystemStorage }
})

test('creating a new media asset from user-selected file saves it to FS storage', async () => {
  using doc = new Document({ resolution, frameRate })
  const fileStorage = vi.mocked((doc.assets as FileSystemAssetStore).fileStorage)

  const blob_ = new Blob([new ArrayBuffer(1)])
  const stream_ = {}
  const mockLoader = vi.mocked<AssetLoader>({
    canLoad: vi.fn(() => true),
    load: vi.fn(() => ({ stream: stream_ }) as any),
  })
  const { loaders } = doc.assets

  loaders.length = 0
  loaders.push(mockLoader)

  doc.importFromJson({
    resolution,
    frameRate,
    assets: [],
    tracks: [makeTrack('track-0', 'audio', [makeClip({ id: 'clip-0', sourceRef: { assetId: 'asset-0' } })])],
  })

  fileStorage.hasCompleteFile.mockResolvedValue(false)
  fileStorage.get.mockResolvedValue(new File([], '---'))

  doc.assets.create(makeAvAsset('asset-0', 2), { source: blob_ })

  expect(doc.assets.has('asset-0')).toBeTruthy()

  expect(fileStorage.hasCompleteFile).toHaveBeenCalledExactlyOnceWith('asset-0')

  await Promise.resolve()
  await Promise.resolve()

  expect(mockLoader.canLoad).toHaveBeenCalledExactlyOnceWith(doc.assets.getAsset('asset-0'))
  expect(fileStorage.create).toHaveBeenCalledExactlyOnceWith('asset-0', stream_, { size: undefined })
})
