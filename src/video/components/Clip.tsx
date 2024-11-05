import { computed, toRef } from '@/framework/reactivity'

import { type Clip as ClipType } from '../Clip'
import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const Clip = (props: { clip: ClipType; editor: VideoEditor }) => {
  const edges = computed(() => {
    const { editor, clip } = props
    const { time, prev, transition } = clip

    // start end end offsets meeting at the centeres of transition overlaps
    return {
      left: editor.secondsToPixels(time.start + (prev?.transition?.duration ?? 0) / 2),
      right: editor.secondsToPixels(time.end - (transition?.duration ?? 0) / 2),
    }
  })

  const getBoxStyle = () => {
    const { left, right } = edges.value
    // TODO: use translate
    return `left:${left}px; width:${right - left}px`
  }

  return (
    <>
      <div
        class="absolute bg-#8888 text-black h-full rounded cursor-grab"
        style={getBoxStyle}
        onClick={() => props.editor.selectClip(props.clip)}
      >
        Clip {() => props.clip.index}
      </div>
      <div
        style={getBoxStyle}
        class={() => [
          'absolute h-full border-solid border-yellow pointer-events-none',
          props.editor.selected.value !== props.clip && 'opacity-0',
        ]}
      />
      <IconButton
        icon={toRef(() => (props.clip.transition ? IconTablerChevronsRight : IconTablerChevronRight))}
        class="absolute z-1"
        style={() => `left: ${edges.value.right}px; translate: -50%`}
        onClick={() => {
          alert('Not implemented.')
        }}
      />
    </>
  )
}
