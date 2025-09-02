import type { SerializedMovie } from '../../types/schema'
import { ROOT_NDOE_ID } from '../constants.ts'

export const createInitialMovie = (generateId: () => string): SerializedMovie =>
  ({
    id: ROOT_NDOE_ID,
    type: 'movie',
    children: [
      {
        id: generateId(),
        type: 'collection',
        kind: 'asset-library',
        children: [],
      },
      {
        id: generateId(),
        type: 'collection',
        kind: 'timeline',
        children: [
          { id: generateId(), type: 'track', trackType: 'video', children: [] },
          { id: generateId(), type: 'track', trackType: 'audio', children: [] },
        ],
      },
    ],
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
  }) satisfies SerializedMovie
