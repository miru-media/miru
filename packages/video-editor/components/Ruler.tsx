import { computed } from 'shared/framework/reactivity'

import { type VideoEditor } from '../VideoEditor'

export const Ruler = ({ editor }: { editor: VideoEditor }) => {
  const intervalS = computed(() => {
    const range = editor.secondsPerPixel.value
    const exponent = Math.floor(Math.log2(range))
    const magnitude = Math.pow(2, exponent)

    return magnitude * 32
  })

  const Markings = () => {
    const size = computed(() => editor.secondsToPixels(intervalS.value))
    const offset = computed(() => (editor.timelineSize.value.width / 2) % size.value)

    return (
      <svg class="ruler-markings" style={() => `--ruler-markings-offset: ${offset.value}px`}>
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
    const getChildren = () => {
      const timelineWidth = editor.timelineSize.value.width
      const timelineRangeS = editor.pixelsToSeconds(timelineWidth)

      const children: JSX.Element[] = []
      const labelSpacing = intervalS.value < 1 ? 4 : 5
      const labelIntervalS = intervalS.value * labelSpacing
      const nLabels = Math.ceil(timelineRangeS / labelIntervalS) + 1

      let fromS = editor.movie.currentTime - timelineRangeS / 2
      fromS = fromS - (fromS % labelIntervalS)

      for (let i = 0; i < nLabels; i++) {
        const time = fromS + i * labelIntervalS

        const left = editor.secondsToPixels(time) + timelineWidth / 2
        children.push(
          <div class="ruler-label text-small" style={`translate:calc(${left}px - 50%)`}>
            {time}s
          </div>,
        )
      }

      return children
    }

    return <div>{getChildren}</div>
  }

  return (
    <div class="ruler">
      <Markings />
      <Labels />
    </div>
  )
}
