import { computed, ref, type Ref, toValue, watch } from 'fine-jsx'

import { useI18n } from 'shared/utils'
import { useCursor } from 'shared/video/use-cursor.ts'
import { useScrubber } from 'shared/video/use-scrubber.ts'
import { formatDuration } from 'shared/video/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

const RULER_INTERVAL_MULTIPLIER = 32

export const Ruler = ({
  scrollOffset,
  timelineOffset,
}: {
  scrollOffset: Ref<number>
  timelineOffset: Ref<number>
}) => {
  const editor = useEditor()
  const { languages } = useI18n()
  const root = ref<HTMLElement>()

  const scrubberContext = {
    pixelsPerSecond: () => 1 / editor._secondsPerPixel.value,
    currentTime: () => editor.currentTime,
    mediaDuration: () => editor.doc.duration,
    offsetX: timelineOffset,
    seekTo: editor.seekTo.bind(editor),
  }

  useScrubber(scrubberContext, root, undefined)

  const cursorProps = useCursor(scrubberContext, root)

  const intervalS = computed(() => {
    const range = editor._secondsPerPixel.value
    const exponent = Math.floor(Math.log2(range))
    const magnitude = 2 ** exponent

    return magnitude * RULER_INTERVAL_MULTIPLIER
  })

  const Markings = (): JSX.Element => {
    const size = computed(() => editor.secondsToPixels(intervalS.value))
    const offset = computed(() => timelineOffset.value % size.value)

    return (
      <svg class={styles.rulerMarkings} style={() => `--ruler-markings-offset: ${offset.value}px`}>
        <defs>
          <pattern id="Pattern" x="0" y="0" width={size} height="100%" patternUnits="userSpaceOnUse">
            <circle cx="0.125rem" cy="50%" r="0.125rem" fill="currentColor" />
          </pattern>
        </defs>

        <rect fill="url(#Pattern)" width="100%" height="100%" />
      </svg>
    )
  }

  const Labels = (): JSX.Element => {
    const formattedDurations = new Map<number, string>()

    watch([languages], formattedDurations.clear.bind(formattedDurations))

    const getChildren = (): JSX.Element[] => {
      const timelineWidth = editor._timelineSize.value.width
      const timelineRangeS = editor.pixelsToSeconds(timelineWidth)
      const offset = timelineOffset.value

      const children: JSX.Element[] = []
      const labelSpacing = intervalS.value < 1 ? 4 : 5
      const labelIntervalS = intervalS.value * labelSpacing
      const nLabels = Math.ceil(timelineRangeS / labelIntervalS) + 1

      let fromS = editor.pixelsToSeconds(toValue(scrollOffset)) - editor.pixelsToSeconds(offset)
      fromS -= fromS % labelIntervalS

      for (let i = 0; i < nLabels; i++) {
        const timeS = fromS + i * labelIntervalS
        const left = editor.secondsToPixels(timeS) + offset

        let durationText = formattedDurations.get(timeS)
        if (!durationText) {
          formattedDurations.set(timeS, (durationText = formatDuration(timeS, 'narrow', languages.value)))
          if (formattedDurations.size > nLabels * 2) {
            const [[key]] = formattedDurations
            formattedDurations.delete(key)
          }
        }

        children.push(
          <div class={[styles.rulerLabel, styles.textSmall]} style={`translate:calc(${left}px - 50%)`}>
            {durationText}
          </div>,
        )
      }

      return children
    }

    return <div>{getChildren}</div>
  }

  return (
    <div
      ref={root}
      {...cursorProps}
      class={styles.ruler}
      onPointerdown={(event: Event) => event.stopPropagation()}
    >
      {() =>
        editor._timelineSize.value.width === 0 ? undefined : (
          <>
            <Markings />
            <Labels />
          </>
        )
      }
    </div>
  )
}
