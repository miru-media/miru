import { computed } from 'fine-jsx'

import type { ClipTime, Schema } from '../../types/core'
import type * as pub from '../../types/core.d.ts'

import { TrackChild } from './track-child.ts'

export class Gap extends TrackChild<Schema.Gap> implements pub.Gap {
  type = 'gap' as const
  declare children: undefined
  declare container: undefined

  readonly #time = computed((): ClipTime => {
    const prevTime = this.prev?.time
    const start = prevTime ? prevTime.start + prevTime.duration : 0
    const end = start + this.duration

    const { duration } = this
    return { start, source: 0, duration, end }
  })

  get time(): ClipTime {
    return this.#time.value
  }

  get start(): number {
    return this.time.start
  }

  declare readonly transition: undefined

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isGap(): this is Gap {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toObject(): Schema.Gap {
    return { id: this.id, type: this.type, duration: this.duration }
  }
}
