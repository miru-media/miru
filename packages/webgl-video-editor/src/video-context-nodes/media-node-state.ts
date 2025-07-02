import { computed, EffectScope, ref, type Ref, watch } from 'fine-jsx'

import { setObjectSize, useEventListener } from 'shared/utils'
import { clamp } from 'shared/utils/math'
import { getImageSize, useMediaReadyState, useRafLoop } from 'shared/video/utils'

import { ReadyState } from '../constants'

import type { MediaElementNode } from './media-element-node'

export class MediaNodeState {
  scope = new EffectScope()
  readyState!: Ref<ReadyState>
  latestEvent = ref<Event>()
  wasEverPlayable = ref(false)
  isSeeking = ref(false)
  isReady = computed(() => this.readyState.value >= ReadyState.HAVE_CURRENT_DATA && !this.isSeeking.value)
  isPaused = ref(true)
  time = ref(0)

  constructor(node: MediaElementNode, movieIsPaused: Ref<boolean>) {
    const { media } = node

    this.isPaused.value = media.paused
    useEventListener(media, 'play', () => (this.isPaused.value = false))
    useEventListener(media, 'pause', () => (this.isPaused.value = true))

    this.scope.run(() => {
      this.readyState = useMediaReadyState(media)

      // update reactive media time
      useRafLoop(() => (this.time.value = media.currentTime), {
        active: () => !movieIsPaused.value,
      })

      const allReadyStateEventTypes = [
        'abort',
        'canplay',
        'canplaythrough',
        'durationchange',
        'emptied',
        'ended',
        'error',
        'loadeddata',
        'loadedmetadata',
        'loadstart',
        'pause',
        'play',
        'playing',
        'seeked',
        'seeking',
        'stalled',
        'suspend',
        'timeupdate',
        'waiting',
      ]
      allReadyStateEventTypes.forEach((type) => {
        useEventListener(media, type, (event) => {
          this.latestEvent.value = event

          this.isSeeking.value = type === 'seeking' ? true : media.readyState < 3
        })
      })

      watch([this.readyState], ([readyState]) => {
        if (readyState >= ReadyState.HAVE_CURRENT_DATA) this.wasEverPlayable.value = true
      })
      ;['canplay', 'suspend'].forEach((type) =>
        useEventListener(
          media,
          type,
          () => {
            if (!('mediaSize' in node) || !('videoWidth' in media)) return

            const { mediaSize, playableTime } = node
            setObjectSize(mediaSize, getImageSize(media))

            const { currentTime } = media

            const start = playableTime.source
            const end = start + playableTime.duration
            if (currentTime < start || currentTime > end) media.currentTime = clamp(currentTime, start, end)
          },
          { once: true },
        ),
      )
    })
  }
}
