import { computed, ref, type Ref, toValue, watch } from 'fine-jsx'

import { useI18n } from 'shared/utils'
import { formatDuration } from 'shared/video/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

const RULER_INTERVAL_MULTIPLIER = 128

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

  const intervalS = computed(() => {
    const range = editor.timelineZoom.secondsPerPixel
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
            <line x1="0.125rem" x2="0.125rem" y1="0" y2="100%" stroke="currentColor" />
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
      const timelineRangeS = editor.pixelsToSeconds(editor._workspaceSize.value.width)
      const offset = timelineOffset.value

      const children: JSX.Element[] = []
      const labelSpacing = 2
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
          <div class={styles.rulerLabel} style={`translate:calc(${left}px)`}>
            {durationText}
          </div>,
        )
      }

      return children
    }

    return <>{getChildren}</>
  }

  return (
    <div ref={root} inert class={styles.ruler} onPointerdown={(event: Event) => event.stopPropagation()}>
      {() =>
        editor._workspaceSize.value.width > 0 && (
          <div class={styles.rulerSizer}>
            <Markings />
            <Labels />
          </div>
        )
      }
    </div>
  )
}
