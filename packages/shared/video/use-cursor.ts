import { isRef, toValue } from 'fine-jsx'
import type { MaybeRefOrGetter } from 'fine-jsx'

import { useEventListener } from 'shared/utils/index.ts'
import { formatDuration } from 'shared/video/utils.ts'

import { ARROW_KEY_DELTA_S } from './constants.ts'

export const useCursor = (
  context: {
    currentTime: MaybeRefOrGetter<number>
    mediaDuration: MaybeRefOrGetter<number>
    seekTo: (timeS: number) => void
  },
  cursor: MaybeRefOrGetter<HTMLElement | undefined>,
): Record<string, unknown> => {
  useEventListener(cursor, 'keydown', (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        const deltaS = ARROW_KEY_DELTA_S * (event.code === 'ArrowLeft' || event.code === 'ArrowUp' ? -1 : 1)
        context.seekTo(toValue(context.currentTime) + deltaS)
        event.preventDefault()
        break
      }
    }
  })

  return {
    tabIndex: 0,
    role: 'slider',
    // TODO: i18n
    'aria-label': 'Cursor',
    'aria-valuetext': () => formatDuration(toValue(context.currentTime), 'long'),
    'aria-valuenow': isRef(context.currentTime) ? context.currentTime : () => toValue(context.currentTime),
    'aria-valuemin': '0',
    'aria-valuemax': isRef(context.mediaDuration)
      ? context.mediaDuration
      : () => toValue(context.mediaDuration),
  }
}
