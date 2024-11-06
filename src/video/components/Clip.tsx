import '@interactjs/actions/resize'
import '@interactjs/modifiers'
import '@interactjs/auto-start'
import { type ResizeEvent } from '@interactjs/actions/resize/plugin'
import interact from '@interactjs/interact'

import { MIN_CLIP_DURATION_S } from '@/constants'
import { computed, effect, ref, toRef } from '@/framework/reactivity'

import { type Clip as ClipType } from '../Clip'
import { type VideoEditor } from '../VideoEditor'

import { IconButton } from './IconButton'

export const Clip = (props: { clip: ClipType; editor: VideoEditor }) => {
  const mainContainer = ref<HTMLElement>()
  const resizeEdges = {
    left: ref<HTMLElement>(),
    right: ref<HTMLElement>(),
  }

  const boxEdges = computed(() => {
    const { editor, clip } = props
    const { time, prev, transition } = clip

    // start, end offsets meeting at the centers of transition overlaps
    return {
      left: editor.secondsToPixels(time.start + (prev?.transition?.duration ?? 0) / 2),
      right: editor.secondsToPixels(time.end - (transition?.duration ?? 0) / 2),
    }
  })

  const getBoxStyle = () => {
    const { left, right } = boxEdges.value
    // TODO: use translate
    return `left:${left}px; width:${right - left}px`
  }

  effect((onCleanup) => {
    const element = mainContainer.value
    if (!element) return

    let edges
    {
      const left = resizeEdges.left.value
      const right = resizeEdges.right.value
      if (!left || !right) return
      edges = { left, right }
    }

    const interactable = interact(element, {
      getRect() {
        const { time } = props.clip
        const left = props.editor.secondsToPixels(time.start)
        const right = props.editor.secondsToPixels(time.end)
        const { top, bottom } = element.getBoundingClientRect()

        return {
          left,
          right,
          top,
          bottom,
        }
      },
      resize: {
        edges,
        modifiers: [
          interact.modifiers.restrictEdges({
            outer: () => {
              const { time, media, prev } = props.clip
              const mediaDuration = media.value.duration
              const minStartTime = Math.max(
                time.end - mediaDuration,
                Math.max(0, prev ? prev.time.start + MIN_CLIP_DURATION_S : 0),
              )
              const maxEndTime = time.start + (mediaDuration - time.source)

              return {
                left: props.editor.secondsToPixels(minStartTime),
                right: props.editor.secondsToPixels(maxEndTime),
                top: -Infinity,
                bottom: Infinity,
              }
            },
          }),
        ],
        listeners: {
          start() {
            props.editor.movie.pause()
          },
          move({ rect }: ResizeEvent) {
            const { editor, clip } = props
            const { prev, transition } = clip
            const newStart = editor.pixelsToSeconds(rect.left)

            // TODO: correct source offset time

            if (prev) {
              const newPrevClipDuration = newStart - prev.time.start + (prev.transition?.duration ?? 0)
              const inTransition = prev.transition

              prev.duration.value = newPrevClipDuration

              const maxTransitionDuration = Math.min(newPrevClipDuration, clip.time.duration)
              if (inTransition && inTransition.duration > maxTransitionDuration) {
                prev.transition = { type: inTransition.type, duration: maxTransitionDuration }
              }
            }

            const newDuraiton = (clip.duration.value = editor.pixelsToSeconds(rect.width))

            if (transition && transition.duration > newDuraiton)
              clip.transition = { duration: newDuraiton, type: transition.type }
          },
        },
      },
    })

    onCleanup(() => interactable.unset())
  })

  return (
    <>
      <div
        ref={mainContainer}
        class={() => [
          'absolute bg-#8888 text-black h-full rounded cursor-pointer select-none border-y-solid overflow-hidden',
          props.editor.selected.value === props.clip ? 'border-yellow' : 'border-transparent',
        ]}
        style={getBoxStyle}
        onClick={() => props.editor.selectClip(props.clip)}
      >
        Clip {() => props.clip.index}
        <div class={() => ['absolute inset-0', props.editor.selected.value !== props.clip && 'hidden']}>
          <div
            ref={resizeEdges.left}
            style={() => (props.clip.prev ? '' : 'visibility: hidden')}
            class="absolute left-0 h-full w-2 bg-yellow"
          />
          <div ref={resizeEdges.right} class="absolute right-0 h-full w-2 bg-yellow" />
        </div>
      </div>
      <IconButton
        icon={toRef(() => (props.clip.transition ? IconTablerChevronsRight : IconTablerChevronRight))}
        class="absolute z-1"
        style={() => `left: ${boxEdges.value.right}px; translate: -50%`}
        onClick={() => {
          alert('Not implemented.')
        }}
      />
    </>
  )
}
