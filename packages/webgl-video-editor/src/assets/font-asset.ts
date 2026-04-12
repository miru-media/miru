import type * as pub from '#core'
import type * as Schema from '#schema'

import { BaseAsset } from './base-asset.ts'

export class FontAsset extends BaseAsset<Schema.FontAsset> implements pub.FontAsset {
  readonly type = 'asset:font' as const

  get name(): string {
    return this.raw.name
  }
  get family(): string {
    return this.raw.family
  }

  toJSON(): pub.Schema.FontAsset {
    return this.raw
  }
}
