import type { Document } from '#core'
import type { Schema } from '#core'

export namespace Otio {
  export interface TimelineDocument {
    OTIO_SCHEMA: 'Timeline.1'
    metadata?: {
      [index: string]: unknown
      Miru: Schema.DocumentSettings & { assets: Schema.AnyAssetSchema[] }
    }
    name: ''
    global_start_time: null
    tracks: TimelineStack
  }

  export interface Rational {
    OTIO_SCHEMA: 'RationalTime.1'
    rate: number
    value: number
  }

  export interface TimeRange {
    OTIO_SCHEMA: 'TimeRange.1'
    duration: Rational
    start_time: Rational
  }

  export interface BaseItem<T extends string = string> {
    OTIO_SCHEMA: T
    name: string
    enabled: boolean
    color: string | null
    metadata: {
      [index: string]: unknown
      Miru?: { [index: string]: unknown; id: string; type: string }
    }
    effects: {
      [index: string]: any
      OTIO_SCHEMA: 'Effect.1'
      name: string
      effect_name: string
      metadata: { [index: string]: unknown; Miru?: Record<string, any> }
    }[]
  }

  export interface TimelineStack extends BaseItem<'Stack.1'> {
    children: Track[]
  }

  export interface Track extends BaseItem<'Track.1'> {
    source_range: TimeRange
    kind: 'Audio' | 'Video'
    children: (Clip | Gap | Transition)[]
  }

  export interface TrackChild<T extends 'Gap.1' | 'Clip.1'> extends BaseItem<T> {
    source_range: TimeRange
  }

  export interface Gap {
    OTIO_SCHEMA: 'Gap.1'
    source_range: TimeRange
  }

  export interface Clip extends TrackChild<'Clip.1'> {
    media_reference?: MediaReference | null
    media_references?: Record<string, MediaReference> | null
    active_media_reference_key?: string | null
  }

  export interface MediaReference {
    OTIO_SCHEMA: 'ExternalReference.1'
    metadata: {
      Miru: Schema.MediaAssetRef | Schema.MediaAssetPlaceholderRef | undefined
      [index: string]: unknown
    }
    name: string | null
    available_range: {
      OTIO_SCHEMA: string
      duration: {
        OTIO_SCHEMA: 'RationalTime.1'
        rate: number
        value: number
      }
      start_time: {
        OTIO_SCHEMA: 'RationalTime.1'
        rate: number
        value: number
      }
    } | null
    target_url: string | null
  }

  export interface Transition {
    OTIO_SCHEMA: 'Transition.1'
    metadata: Record<string, unknown>
    name: 'Transition'
    in_offset: Rational
    out_offset: Rational
    transition_type: string
  }
}

export const documentJSONFromOTIO: (
  otio: Otio.TimelineDocument,
  options: RequestInit = {},
) => Promise<Schema.SerializedDocument>

export const documentToOTIO: (doc: Document) => Otio.TimelineDocument
