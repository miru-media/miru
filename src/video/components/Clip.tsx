import { type Clip as ClipType } from '../Clip'
import { type VideoEditor } from '../VideoEditor'

export const Clip = (props: { clip: ClipType; editor: VideoEditor }) => {
  const getStyle = () => {
    const { editor } = props

    const time = props.clip.time
    const startPx = editor.secondsToPixels(time.start)
    const endPx = editor.secondsToPixels(time.end)

    return `left:${startPx}px; width:${endPx - startPx}px`
  }

  const onClick = () => props.editor.selectClip(props.clip)

  return (
    <>
      <div class="absolute bg-#8888 text-black h-full rounded cursor-grab" style={getStyle} onClick={onClick}>
        Clip {() => props.clip.index}
      </div>
      <div
        style={getStyle}
        class={() => [
          'absolute h-full border-solid border-yellow pointer-events-none',
          props.editor.selected.value !== props.clip && 'opacity-0',
        ]}
      />
    </>
  )
}
