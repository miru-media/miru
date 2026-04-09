import { Button } from 'shared/components/button.tsx'
import { formatDuration, formatTime } from 'shared/video/utils'

import styles from '../media-trimmer.module.css'
import type { TrimmerUiContext } from '../trimmer-ui-context.ts'

export const PlaybackControls = ({ context }: { context: TrimmerUiContext }) => {
  const onToggleMute = () => {
    const { start, end, mute } = context.state.value
    context.onChange({ start, end, mute: !mute })
  }

  return (
    <div class={[styles.controls, styles.numeric]}>
      <div class={[styles.controlsLeft, styles.playPause]}>
        <Button
          disabled={() => context.mediaDuration.value === 0}
          onClick={context.togglePlayback.bind(context)}
          label={() => (context.isPaused.value ? 'Play' : 'Pause')}
        >
          {() => (context.isPaused.value ? <IconTablerPlayerPlay /> : <IconTablerPlayerPause />)}
        </Button>
      </div>
      <div class={styles.controlsCenter}>{() => formatTime(context.currentTime.value, false)}</div>
      <div class={styles.controlsRight}>
        <div>
          {() => {
            const { start, end } = context.state.value
            formatDuration(Math.round(end - start))
          }}
        </div>
        {() =>
          context.unableToDecode.value ? (
            <div></div>
          ) : context.hasAudio.value ? (
            <Button
              label={() => (context.state.value.mute ? 'Include audio' : 'Remove audio')}
              onClick={onToggleMute}
            >
              {() => (context.state.value.mute ? <IconTablerVolumeOff /> : <IconTablerVolume />)}
            </Button>
          ) : (
            <Button disabled onClick={() => undefined} label="No audio track">
              <IconTablerVolume_3 />
            </Button>
          )
        }
      </div>
    </div>
  )
}
