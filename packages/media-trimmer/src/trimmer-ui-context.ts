import { computed, type MaybeRefOrGetter, type Ref, ref } from 'fine-jsx'
import { toRef } from 'fine-jsx'

import { clamp, useElementSize, useEventListener } from 'shared/utils'
import type { ReadyState } from 'shared/video/constants'
import { useMediaReadyState } from 'shared/video/utils'

import type { TrimState } from './types/ui'
import { hasRequiredApis } from './utils.ts'

const EPSILON = 0.01

export class TrimmerUiContext {
  readonly isPaused = ref(true)
  readonly hasAudio = ref(false)
  readonly state: Ref<TrimState>
  readonly currentTime = ref(0)
  readonly errorMessage = ref('')
  readonly unableToDecode = ref(!hasRequiredApis())
  readonly mediaDuration = ref(0)
  readonly readyState: Ref<ReadyState>

  readonly pixelsPerSecond: Ref<number>
  readonly onChange: (state: TrimState) => unknown
  readonly media: HTMLVideoElement

  constructor(
    state: Ref<TrimState>,
    scrubberContainer: MaybeRefOrGetter<HTMLElement | undefined>,
    onChange: (state: TrimState) => unknown,
  ) {
    this.state = toRef(state)
    const media = (this.media = document.createElement('video'))
    this.readyState = useMediaReadyState(media)
    media.playsInline = true
    media.preload = 'auto'

    const containerSize = useElementSize(scrubberContainer)
    this.onChange = onChange
    this.pixelsPerSecond = computed(() => containerSize.value.width / this.mediaDuration.value || 0)
    ;['timeupdate', 'seeking'].forEach((type) => {
      useEventListener(media, type, () => (this.currentTime.value = this.media.currentTime))
    })
    ;['play', 'pause'].forEach((type) => {
      useEventListener(media, type, () => (this.isPaused.value = this.media.paused))
    })
  }

  togglePlayback(): void {
    const { media } = this
    if (this.isPaused.value) {
      const { start, end } = this.state.value
      if (this.currentTime.value + EPSILON >= end || media.ended) this.seekTo(start)
      media.play().catch(() => undefined)
    } else media.pause()
  }

  seekTo(time: number): void {
    const { start, end } = this.state.value
    this.media.currentTime = this.currentTime.value = clamp(time, start, end)
  }
}
