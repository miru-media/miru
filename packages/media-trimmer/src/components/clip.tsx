import { computed, ref } from 'fine-jsx'

import { useEventListener } from 'shared/utils'
import { clamp } from 'shared/utils/math'
import { ARROW_KEY_DELTA_S } from 'shared/video/constants.ts'
import { formatDuration } from 'shared/video/utils.ts'

import styles from '../media-trimmer.module.css'
import type { TrimmerUiContext } from '../trimmer-ui-context.ts'

const MIN_CLIP_DURATION_S = 0.25
const MIN_CLIP_WIDTH_PX = 1
export const Clip = ({ context }: { context: TrimmerUiContext }) => {
  const { state } = context
  const resizeLeft = ref<HTMLElement>()
  const resizeRight = ref<HTMLElement>()
  const boxEdges = computed(() => {
    const { start, end } = state.value
    const pps = context.pixelsPerSecond.value
    const left = start * pps
    const right = Math.max(end * pps, left + MIN_CLIP_WIDTH_PX)

    return { left, right }
  })

  const isResizing = ref<'left' | 'right'>()
  const downCoords = { x: 0, y: 0 }
  const initialTime = { start: 0, duration: 0 }

  const onPointerDown = (event: PointerEvent): void => {
    if (!!isResizing.value || event.button !== 0) return
    const handle = event.currentTarget as HTMLElement

    downCoords.x = event.pageX
    downCoords.y = event.pageY

    const { start, end } = state.value
    initialTime.start = start
    initialTime.duration = end - start

    handle.setPointerCapture(event.pointerId)
    isResizing.value = handle === resizeLeft.value ? 'left' : 'right'
    event.stopPropagation()
    event.preventDefault()
  }
  const onPointerMove = (event: PointerEvent): void => {
    if (!isResizing.value) return

    const deltaS = (event.pageX - downCoords.x) / context.pixelsPerSecond.value

    changeEdgeBy(isResizing.value, deltaS)
    event.stopPropagation()
  }
  const onLostPointer = (event: PointerEvent): void => {
    isResizing.value = undefined
    event.stopPropagation()
  }

  const changeEdgeBy = (edge: 'left' | 'right', deltaS: number): void => {
    let newStartTime
    let newDuration
    const { start, end } = state.value

    if (edge === 'left') {
      newStartTime = clamp(
        initialTime.start + deltaS,
        0,
        initialTime.start + initialTime.duration - MIN_CLIP_DURATION_S,
      )
      newDuration = end - start + (start - newStartTime)
    } else {
      newStartTime = start
      newDuration = clamp(
        initialTime.duration + deltaS,
        MIN_CLIP_DURATION_S,
        context.mediaDuration.value - initialTime.start,
      )
    }

    const newEndTime = newStartTime + newDuration

    context.onChange({ start: newStartTime, end: newEndTime, mute: state.value.mute })
    if (edge === 'left') context.seekTo(newStartTime)
    else context.seekTo(newEndTime)
  }

  ;[resizeLeft, resizeRight].forEach((handleRef) => {
    useEventListener(handleRef, 'pointerdown', onPointerDown)
    useEventListener(handleRef, 'pointermove', onPointerMove)
    useEventListener(handleRef, 'lostpointercapture', onLostPointer)
    useEventListener(handleRef, 'keydown', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey) return

      switch (event.code) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          const deltaS = ARROW_KEY_DELTA_S * (event.code === 'ArrowLeft' || event.code === 'ArrowUp' ? -1 : 1)
          const { start, end } = state.value
          initialTime.start = start
          initialTime.duration = end - start
          changeEdgeBy(handleRef === resizeLeft ? 'left' : 'right', deltaS)
          event.stopPropagation()
          event.preventDefault()
          break
        }
        default:
      }
    })
  })

  return (
    <div
      class={[styles.clip, styles.isSelected, styles.canResizeLeft]}
      style={() =>
        `--clip-box-left:${boxEdges.value.left}px;--clip-box-right:${boxEdges.value.right}px;--clip-color:transparent`
      }
    >
      <div class={styles.clipBox}>
        <div class={styles.clipControls}>
          <div
            ref={resizeLeft}
            class={styles.clipResizeLeft}
            ariaValueText={() => formatDuration(state.value.start, 'long')}
            ariaValueNow={() => state.value.start}
            ariaValueMin={0}
            ariaValueMax={() => state.value.end}
            tabindex="0"
          >
            <IconTablerChevronLeft />
          </div>
          <div
            ref={resizeRight}
            class={styles.clipResizeRight}
            ariaValueText={() => formatDuration(state.value.end, 'long')}
            ariaValueNow={() => state.value.end}
            ariaValueMin={() => state.value.start}
            ariaValueMax={() => context.mediaDuration.value}
            tabindex="0"
          >
            <IconTablerChevronRight />
          </div>
        </div>
      </div>
    </div>
  )
}
