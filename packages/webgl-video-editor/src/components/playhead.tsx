import { computed, ref } from 'fine-jsx'

import { useElementSize } from 'shared/utils'
import { splitTime } from 'shared/video/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const Playhead = (): JSX.Element => {
  const editor = useEditor()
  const interactiveEl = ref<HTMLElement>()
  const size = useElementSize(interactiveEl)

  const timeParts = computed(() => splitTime(editor.doc.currentTime))

  return (
    <>
      <div inert class={styles.timelinePlayhead} style={() => `--time-pill-width: ${size.value.width}px`}>
        {() =>
          editor.isMobileWorkspace ? (
            <span ref={interactiveEl} class={[styles.timePill, styles.textBodySmall, styles.numeric]}>
              <span>
                {() => timeParts.value.hours}:{() => timeParts.value.minutes}
              </span>
              <span class={styles.timePillRight}>
                {() => timeParts.value.seconds}.{() => timeParts.value.subSeconds}
              </span>

              <svg class={styles.timePillDrop} viewBox="0 0 16 8" fill="none" role="presentation">
                <path
                  d="M7.99282 8C7.99282 8 10.3614 0 15.3381 0C20.3147 0 -4.57808 0 0.753127 0C6.08433 0 7.99282 8 7.99282 8Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          ) : (
            <svg
              ref={interactiveEl}
              class={styles.timelinePlayheadHandle}
              width="11"
              height="12"
              viewBox="0 0 11 12"
            >
              <path
                d="M0 2C0 0.895432 0.895431 0 2 0H9C10.1046 0 11 0.89543 11 2V5.86249C11 6.4067 10.7782 6.92742 10.3858 7.30451L6.88584 10.6682C6.11172 11.4121 4.88828 11.4121 4.11416 10.6682L0.614157 7.30451C0.221771 6.92742 0 6.4067 0 5.86249V2Z"
                fill="#FFFB24"
              />
            </svg>
          )
        }
        <div class={styles.timelineCursor} />
      </div>
    </>
  )
}
