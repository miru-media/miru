import { computed, watch } from 'fine-jsx'

import { useI18n } from 'shared/utils'
import { formatDuration } from 'shared/video/utils'

import styles from '../css/index.module.css'
import type { VideoEditor } from '../video-editor.ts'

const RULER_INTERVAL_MULTIPLIER = 32

export const Ruler = ({ editor }: { editor: VideoEditor }) => {
  const { languages } = useI18n()

  const intervalS = computed(() => {
    const range = editor._secondsPerPixel.value
    const exponent = Math.floor(Math.log2(range))
    const magnitude = Math.pow(2, exponent)

    return magnitude * RULER_INTERVAL_MULTIPLIER
  })

  const Markings = () => {
    const size = computed(() => editor.secondsToPixels(intervalS.value))
    const offset = computed(() => (editor._timelineSize.value.width / 2) % size.value)

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

  const Labels = () => {
    const formattedDurations = new Map<number, string>()

    watch([languages], formattedDurations.clear.bind(formattedDurations))

    const getChildren = () => {
      const timelineWidth = editor._timelineSize.value.width
      const timelineRangeS = editor.pixelsToSeconds(timelineWidth)
      const halfTimelineWidth = timelineWidth / 2

      const children: JSX.Element[] = []
      const labelSpacing = intervalS.value < 1 ? 4 : 5
      const labelIntervalS = intervalS.value * labelSpacing
      const nLabels = Math.ceil(timelineRangeS / labelIntervalS) + 1

      let fromS = editor._movie.currentTime - timelineRangeS / 2
      fromS = fromS - (fromS % labelIntervalS)

      for (let i = 0; i < nLabels; i++) {
        const timeS = fromS + i * labelIntervalS
        const left = editor.secondsToPixels(timeS) + halfTimelineWidth

        let durationText = formattedDurations.get(timeS)
        if (!durationText) {
          formattedDurations.set(timeS, (durationText = formatDuration(timeS, languages.value)))
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

  const onClick = (event: PointerEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const timeS = editor.pixelsToSeconds(event.clientX - rect.left - editor._timelineSize.value.width / 2)

    editor.seekTo(timeS)
  }

  return (
    <div class={styles.ruler} onClick={onClick}>
      <Markings />
      <Labels />
    </div>
  )
}
