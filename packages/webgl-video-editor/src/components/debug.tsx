import type { InputEvent } from 'shared/types'
import { Rational } from 'shared/utils'
import { ReadyState } from 'shared/video/constants.ts'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

export const Debug = (): JSX.Element => {
  const editor = useEditor()

  return (
    <div class={styles.textBodySmall} style={() => `width:100%; padding:0.25rem; overflow:auto;`}>
      {editor.playback.stats.dom}
      <p style="display:flex;gap:0.25rem">
        {() =>
          editor.doc.timeline.children.map((track) =>
            track.children.map((clip) => {
              if (!clip.isMediaClip()) return null

              const playbackClip = editor.playback._getNode(clip)
              const { mediaState } = playbackClip

              return (
                <div style="font-family:monospace">
                  <div>
                    {() =>
                      [playbackClip.mediaTime.value.toFixed(2), mediaState.latestEvent.value?.type].join(' ')
                    }
                  </div>
                  <div>
                    {() => (
                      <>
                        {Object.keys(ReadyState).find(
                          (key) => ReadyState[key as keyof typeof ReadyState] === mediaState.readyState.value,
                        )}{' '}
                        | {playbackClip.mediaState.error.value?.code}
                      </>
                    )}
                  </div>

                  <div>
                    <label>
                      source time{' '}
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.25"
                        value={() => clip.sourceStart.valueOf()}
                        onInput={(event: InputEvent) =>
                          (clip.sourceStart = Rational.fromDecimal(
                            event.target.valueAsNumber,
                            clip.sourceStart.rate,
                          ))
                        }
                      />
                    </label>
                    [{() => clip.time.start.toFixed(2)}, {() => clip.time.end.toFixed(2)}]{' | '}
                  </div>
                </div>
              )
            }),
          )
        }
      </p>
    </div>
  )
}
