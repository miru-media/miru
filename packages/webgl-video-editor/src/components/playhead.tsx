import { computed, ref } from 'fine-jsx'

import { useElementSize } from 'shared/utils'
import { splitTime } from 'shared/video/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const Playhead = (): JSX.Element => {
  const editor = useEditor()
  const root = ref<HTMLElement>()
  const size = useElementSize(root)

  const timeParts = computed(() => splitTime(editor.doc.currentTime))

  return (
    <>
      <div
        ref={root}
        class={styles.timelinePlayhead}
        style={() => `--time-pill-width: ${size.value.width}px`}
      >
        <span class={[styles.timePill, styles.textBodySmall, styles.numeric]}>
          <span>
            {() => timeParts.value.hours}:{() => timeParts.value.minutes}
          </span>
          <span class={styles.timePillRight}>
            {() => timeParts.value.seconds}.{() => timeParts.value.subSeconds}
          </span>

          <svg class={styles.timePillDrop} viewBox="0 0 16 8" fill="none">
            <path
              d="M7.99282 8C7.99282 8 10.3614 0 15.3381 0C20.3147 0 -4.57808 0 0.753127 0C6.08433 0 7.99282 8 7.99282 8Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>
      <div class={styles.timelineCursor} />
    </>
  )
}
