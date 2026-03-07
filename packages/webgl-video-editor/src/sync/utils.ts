import type * as Schema from '#schema'

export const createInitialDocument = (): Schema.SerializedDocument =>
  ({
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
    assets: [],
    tracks: [],
  }) satisfies Schema.SerializedDocument
