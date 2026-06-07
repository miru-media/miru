import { uid } from 'uid'

import type { AnyClip, AnyVideoClip, AudioClip, VideoEditor } from '#core'
import type { InputEvent } from 'shared/types.ts'
import { clamp, useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

const PERCENT = 100
const HALF_TURN_DEG = 180

interface SubComponentProps<T extends AnyClip> {
  editor: VideoEditor
  clip: T
  i18n: ReturnType<typeof useI18n>
}

const getNumberInputProps = (
  getter: () => number,
  setter: (value: number) => unknown,
  labelledBy: string,
  min: number,
  max: number,
  displayScale = 1,
  // eslint-disable-next-line @typescript-eslint/max-params -- internal
) => {
  const getDomValue = () => Math.round(getter() * displayScale)
  const onInput = (event: InputEvent) => {
    const value = event.target.valueAsNumber
    if (!Number.isNaN(value) && Number.isFinite(value)) setter(clamp(value / displayScale || 0, min, max))
  }

  return {
    min: min * displayScale,
    max: max * displayScale,
    step: 1,
    value: getDomValue,
    onInput,
    'aria-labelledby': labelledBy,
  }
}

export const ClipProperties = () => {
  const editor = useEditor()
  const i18n = useI18n()

  return (
    <>
      {() => {
        const clip = editor.selection

        if (!clip?.isClip()) return

        return (
          <section class={styles.workspaceProperties}>
            <div class={styles.panelBody}>
              {() => clip.isVideo() && <VideoClipProperties {...{ editor, i18n, clip }} />}
              {() => clip.isAudio() && <AudioClipProperties {...{ editor, i18n, clip }} />}
            </div>
          </section>
        )
      }}
    </>
  )
}

const VideoClipProperties = ({ clip, i18n: { t } }: SubComponentProps<AnyVideoClip>) => {
  const id = uid()
  const scaleId = `scale-${id}`
  const positionId = `x-${id}`
  const xId = `x-${id}`
  const yId = `y-${id}`
  const rotateId = `y-${id}`

  const scaleInputProps = getNumberInputProps(
    () => clip.scale.x,
    (value) => (clip.scale = { x: value, y: value }),
    scaleId,
    1 / 10,
    10,
    PERCENT,
  )

  const xInputProps = getNumberInputProps(
    () => clip.translate.x,
    (value) => (clip.translate = { x: value, y: clip.translate.y }),
    `${positionId} ${xId}`,
    -Infinity,
    Infinity,
  )

  const yInputProps = getNumberInputProps(
    () => clip.translate.y,
    (value) => (clip.translate = { y: value, x: clip.translate.x }),
    `${positionId} ${yId}`,
    -Infinity,
    Infinity,
  )

  const rotateInputProps = getNumberInputProps(
    () => clip.rotate,
    (value) => (clip.rotate = value),
    rotateId,
    -HALF_TURN_DEG,
    HALF_TURN_DEG,
  )

  return (
    <>
      <h1 class={styles.panelHeading}>{t('transform')}</h1>

      <h2 id={scaleId} class={styles.panelSubheading}>
        {t('scale')}
      </h2>

      <div class={styles.inputRow}>
        <input type="range" {...scaleInputProps} />

        <label class={[styles.numberInput, styles.asText]}>
          <input type="number" {...scaleInputProps} />
          <span class={styles.inputSuffix}>%</span>
        </label>
      </div>

      <h2 id={positionId} class={styles.panelSubheading}>
        {t('position')}
      </h2>

      <div class={styles.inputRow}>
        <label class={styles.numberInput}>
          <span id={xId} class={styles.inputPrefix}>
            X
          </span>
          <input type="number" {...xInputProps} />
        </label>

        <label class={styles.numberInput}>
          <span id={yId} class={styles.inputPrefix}>
            Y
          </span>
          <input type="number" {...yInputProps} />
        </label>
      </div>

      <h2 id={rotateId} class={styles.panelSubheading}>
        {t('rotate')}
      </h2>

      <div class={styles.inputRow}>
        <input type="range" {...rotateInputProps} />

        <label class={[styles.numberInput, styles.asText]}>
          <input type="number" {...rotateInputProps} />
          <span class={styles.inputUnit}>°</span>
        </label>
      </div>
    </>
  )
}

const AudioClipProperties = ({ clip, i18n: { t } }: SubComponentProps<AudioClip>) => {
  const headingId = uid()

  const volumeInputProps = getNumberInputProps(
    () => clip.volume,
    (value) => (clip.volume = value),
    headingId,
    0,
    1,
    PERCENT,
  )

  return (
    <>
      <h1 class={styles.panelHeading}>{t('audio_properties')}</h1>

      <h1 id={headingId} class={styles.panelHeading}>
        {t('volume')}
      </h1>

      <div class={styles.inputRow}>
        <input type="range" {...volumeInputProps} />

        <label class={[styles.numberInput, styles.asText]}>
          <input type="number" {...volumeInputProps} />
          <span class={styles.inputUnit}>%</span>
        </label>
      </div>
    </>
  )
}
