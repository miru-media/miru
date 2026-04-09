import { ref, toValue } from 'fine-jsx'
import type { MaybeRefOrGetter } from 'fine-jsx'

import { useEventListener } from 'shared/utils/index.ts'

export const useScrubber = (
  context: {
    pixelsPerSecond: MaybeRefOrGetter<number>
    currentTime: MaybeRefOrGetter<number>
    mediaDuration: MaybeRefOrGetter<number>
    seekTo: (timeS: number) => void
  },
  container: MaybeRefOrGetter<HTMLElement | undefined>,
  cursor: MaybeRefOrGetter<HTMLElement | undefined>,
): void => {
  const isScrubbing = ref(false)

  const onScrubberDown = (event: PointerEvent): void => {
    if (isScrubbing.value || event.button !== 0) return

    const target = event.currentTarget as HTMLElement

    target.setPointerCapture(event.pointerId)
    isScrubbing.value = true
    onScrubberMove({ offsetX: event.clientX - target.getBoundingClientRect().left })
  }

  const onScrubberMove = ({ offsetX }: Pick<PointerEvent, 'offsetX'>): void => {
    if (!isScrubbing.value) return
    const time = offsetX / toValue(context.pixelsPerSecond)
    context.seekTo(time)
  }
  const onScrubberUp = (): void => {
    isScrubbing.value = false
    toValue(cursor)?.focus()
  }

  useEventListener(container, 'pointerdown', onScrubberDown)
  useEventListener<PointerEvent>(container, 'pointermove', onScrubberMove)
  useEventListener(container, 'lostpointercapture', onScrubberUp)
}
