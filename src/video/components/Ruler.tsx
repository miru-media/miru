import { computed } from '@/framework/reactivity'

import { type VideoEditor } from '../VideoEditor'

export const Ruler = ({ editor }: { editor: VideoEditor }) => {
  const intervalS = computed(() => {
    const range = editor.secondsPerPixel.value
    const exponent = Math.floor(Math.log2(range))
    const magnitude = Math.pow(2, exponent)

    return magnitude * 32
  })

  const Markings = () => {
    const style = () => {
      const $intervalS = intervalS.value
      const size = editor.secondsToPixels($intervalS)
      const offset = -size / 2 + ((editor.timelineSize.value.width / 2) % size)

      return `
        --ruler-interval: ${size}px;
        --ruler-markings-offset: ${offset}px;
      `
    }

    return <div class="ruler-markings" style={style}></div>
  }

  const Labels = () => {
    const LABEL_SPACING = 5

    const getChildren = () => {
      const timelineWidth = editor.timelineSize.value.width
      const timelineRangeS = editor.pixelsToSeconds(timelineWidth)

      const children: JSX.Element[] = []
      const labelIntervalS = intervalS.value * LABEL_SPACING
      const nLabels = Math.ceil(timelineRangeS / labelIntervalS) + 1

      let fromS = Math.max(editor.movie.currentTime - timelineRangeS / 2, 0)
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
