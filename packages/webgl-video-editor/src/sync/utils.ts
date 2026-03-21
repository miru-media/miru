import type * as Schema from '#schema'

export const createInitialDocument = (): Schema.SerializedDocument =>
  ({
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
    assets: [],
    timeline: {
      id: 'timeline',
      type: 'timeline',
      children: [],
    },
  }) satisfies Schema.SerializedDocument
