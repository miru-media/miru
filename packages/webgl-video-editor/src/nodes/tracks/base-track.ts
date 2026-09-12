import { computed, ref, type Ref } from 'fine-jsx'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type { Schema } from '#core'
import type { NonOverlappingUnion } from '#internal'
import { Rational } from 'shared/utils/math.ts'

import { ParentNode } from '../parent-node.ts'

export interface BaseTrack<
  T extends Schema.AnyTrack,
  TChild extends pub.AnyTrackChild,
> extends NonOverlappingUnion<ParentNode<T, pub.Timeline, TChild>, pub.AnyTrack> {}

export abstract class BaseTrack<T extends Schema.AnyTrack, TChild extends pub.AnyTrackChild>
  extends ParentNode<T, pub.Timeline, TChild>
  implements pub.BaseTrack<TChild>
{
  static FIELDS = super.FIELDS.concat([
    { key: 'duration', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'link', flags: NODE_FIELD_FLAGS.Readonly },
  ] satisfies pub.NodeFieldDef<pub.AnyTrack>[])

  readonly #duration = computed(() => this.tail?.timeRational.end ?? Rational.ZERO)

  get duration(): Rational {
    return this.#duration.value
  }

  declare _link: Ref<Schema.NodeLink | undefined>
  get link(): Schema.NodeLink | undefined {
    return this._link.value
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  protected _init(): void {
    this._link = ref()
  }

  isTrack(): this is pub.AnyTrack {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  delete(): void {
    const { link } = this
    if (link) this.doc.deleteLink(link.id)
    super.delete()
  }
}
