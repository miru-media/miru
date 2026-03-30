import { ref } from 'fine-jsx'
import type { MaybeRefOrGetter } from 'fine-jsx'

import { useEventListener } from 'shared/utils'

import type { TrimmerUiContext } from '../trimmer-ui-context.ts'

export const useScrubber = (
  context: TrimmerUiContext,
  container: MaybeRefOrGetter<HTMLElement | undefined>,
) => {
  const isScrubbing = ref(false)

  const onScrubberDown = (event: PointerEvent) => {
    if (isScrubbing.value || event.button !== 0) return

    const target = event.currentTarget as HTMLElement

    target.setPointerCapture(event.pointerId)
    isScrubbing.value = true
    onScrubberMove({ offsetX: event.clientX - target.getBoundingClientRect().left })
  }

  const onScrubberMove = ({ offsetX }: Pick<PointerEvent, 'offsetX'>): void => {
    if (!isScrubbing.value) return
    const time = offsetX / context.pixelsPerSecond.value
    context.seekTo(time)
  }
  const onScrubberUp = (): void => {
    isScrubbing.value = false
  }

  useEventListener(container, 'pointerdown', onScrubberDown)
  useEventListener<PointerEvent>(container, 'pointermove', onScrubberMove)
  useEventListener(container, 'lostpointercapture', onScrubberUp)
}
