import { expect, test, vi } from 'vitest'

import type { FileSystemAssetStore } from '#assets'
import type { AssetLoader } from '#core'

import { Document } from '../src/document.ts'
import type { FileSystemStorage } from '../src/storage/file-system-storage.ts'

import { docWithTracks } from './test-content.ts'
import { makeAvAsset, makeTrack, makeVideoClip } from './utils.ts'

vi.mock('../src/storage/file-system-storage.ts', () => {
  const FileSystemStorage = vi.fn(
    class implements Pick<FileSystemStorage, 'create' | 'delete' | 'dispose' | 'hasCompleteFile' | 'get'> {
      get = vi.fn(() => Promise.resolve(undefined as any))
      create = vi.fn(() => Promise.resolve(undefined as any))
      delete = vi.fn(() => Promise.resolve(undefined as any))
      dispose = vi.fn()
      hasCompleteFile = vi.fn(() => Promise.resolve(false))
    },
  )
  return { FileSystemStorage }
})

test('creating a new media asset from user-selected file saves it to FS storage', async () => {
  using doc = new Document({})
  const fileStorage = vi.mocked((doc.assets as FileSystemAssetStore).fileStorage)

  const blob_ = new Blob([new ArrayBuffer(1)])
  const mockLoader = vi.mocked<AssetLoader>({
    canLoad: vi.fn(() => true),
    load: vi.fn(() => ({ stream: {} }) as any),
  })
  const { loaders } = doc.assets

  loaders.length = 0
  loaders.push(mockLoader)

  doc.importFromJson(
    docWithTracks([
      makeTrack('track-0', 'audio', [makeVideoClip({ id: 'clip-0', mediaRef: { assetId: 'asset-0' } })]),
    ]),
  )

  fileStorage.hasCompleteFile.mockResolvedValue(false)
  fileStorage.get.mockResolvedValue(new File([], '---'))

  doc.assets.create(makeAvAsset('asset-0', 2), { source: blob_ })

  expect(doc.assets.has('asset-0')).toBeTruthy()

  expect(fileStorage.hasCompleteFile).toHaveBeenCalledExactlyOnceWith('asset-0')
  await Promise.all(fileStorage.hasCompleteFile.mock.results.map((r) => r.value))

  expect(fileStorage.create).toHaveBeenCalledExactlyOnceWith('asset-0', expect.any(ReadableStream), {
    size: blob_.size,
  })
  expect(fileStorage.get).toHaveBeenCalledExactlyOnceWith('asset-0', 'asset-0', { type: 'video/mp4' })
})
