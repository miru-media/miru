import { computed } from 'fine-jsx'
import { uid } from 'uid'

import styles from '#index.module.css'
import type { StringKeyof } from '#internal'
import type { InputEvent } from 'shared/types.ts'
import { clamp, useI18n } from 'shared/utils/index.ts'

import type { EditView } from '../document-views/edit/edit-nodes.ts'

import { useEditor } from './utils.ts'

const PERCENT = 100
const HALF_TURN_DEG = 180

interface SubComponentProps<T extends EditView.AnyClip> {
  clip: T
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

const KeyframeButton = <T extends EditView.AnyClip>({ clip, keys }: { clip: T; keys: StringKeyof<T>[] }) => {
  const getClipTime = () => clip.docView._currentFrameTime.value.subtract(clip.timeRational.start)
  const animations = keys
    .map((key) => [key, clip.animations[key]] as const)
    .filter((entry): entry is [(typeof entry)[0], NonNullable<(typeof entry)[1]>] => !!entry[1])

  const hasKeyframesAtCurrentTime = computed(() => {
    const time = getClipTime()
    return animations.some(([, a]) => a.indexOfKeyframeAt(time) >= 0)
  })

  const onClick = () => {
    clip._toggleKeyframesAt(
      animations.map(([key]) => key as any),
      getClipTime(),
    )
  }

  return (
    <button class={styles.propertiesKeyframe} onClick={onClick}>
      {() => (hasKeyframesAtCurrentTime.value ? <IconMsSquareRounded /> : <IconMsSquareOutlineRounded />)}
    </button>
  )
}

export const ClipProperties = () => {
  const editor = useEditor()

  return (
    <>
      {() => {
        const { selection } = editor

        if (!selection?.isNode || !selection.isClip()) return

        return (
          <section class={styles.workspaceProperties}>
            <div class={styles.panelBody}>
              {() => selection.isVideo() && <VideoClipProperties {...{ clip: selection }} />}
              {() => selection.isAudio() && <AudioClipProperties {...{ clip: selection }} />}
              {/* TODO: improve linking UX */}
              {() => {
                const linkedAudio =
                  selection.isVideo() && selection.isMediaClip() ? selection.linkedAudio : undefined

                return (
                  linkedAudio?.mediaRef && (
                    <AudioClipProperties
                      {...{ clip: editor.doc.nodes.get<EditView.AudioClip>(linkedAudio.id) }}
                    />
                  )
                )
              }}
            </div>
          </section>
        )
      }}
    </>
  )
}

const VideoClipProperties = ({ clip }: SubComponentProps<EditView.AnyVideoClip>) => {
  const { t } = useI18n()
  const id = uid()
  const scaleId = `scale-${id}`
  const positionId = `position-${id}`
  const xId = `x-${id}`
  const yId = `y-${id}`
  const rotateId = `rotate-${id}`
  const opacityId = `opacity-${id}`

  const scaleInputProps = getNumberInputProps(
    () => clip.scaleX,
    (value) => {
      clip.scaleX = clip.scaleY = value
    },
    scaleId,
    1 / 10,
    10,
    PERCENT,
  )

  const xInputProps = getNumberInputProps(
    () => clip.translateX,
    (value) => (clip.translateX = value),
    `${positionId} ${xId}`,
    -Infinity,
    Infinity,
  )

  const yInputProps = getNumberInputProps(
    () => clip.translateY,
    (value) => (clip.translateY = value),
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

  const opacityInputProps = getNumberInputProps(
    () => clip.opacity,
    (value) => (clip.opacity = value),
    opacityId,
    0,
    1,
    PERCENT,
  )

  return (
    <>
      <h2 class={styles.panelHeading}>{t('prop_transform')}</h2>

      <h3 id={scaleId} class={styles.panelSubheading}>
        {t('prop_scale')}
      </h3>

      <div class={styles.inputRow}>
        <input type="range" {...scaleInputProps} />

        <label class={[styles.numberInput, styles.asText]}>
          <input type="number" {...scaleInputProps} />
          <span class={styles.inputSuffix}>%</span>
        </label>

        <KeyframeButton clip={clip} keys={['scaleX', 'scaleY']} />
      </div>

      <h3 id={positionId} class={styles.panelSubheading}>
        {t('prop_translate')}
      </h3>

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

        <KeyframeButton clip={clip} keys={['translateX', 'translateY']} />
      </div>

      <h3 id={rotateId} class={styles.panelSubheading}>
        {t('prop_rotate')}
      </h3>

      <div class={styles.inputRow}>
        <input type="range" {...rotateInputProps} />

        <label class={[styles.numberInput, styles.asText]}>
          <input type="number" {...rotateInputProps} />
          <span class={styles.inputUnit}>°</span>
        </label>

        <KeyframeButton clip={clip} keys={['rotate']} />
      </div>

      <h2 class={styles.panelHeading}>{t('prop_appearance')}</h2>
      <h3 id={rotateId} class={styles.panelSubheading}>
        {t('prop_opacity')}
      </h3>

      <div class={styles.inputRow}>
        <input type="range" {...opacityInputProps} />

        <label class={[styles.numberInput, styles.asText]}>
          <input type="number" {...opacityInputProps} />
          <span class={styles.inputUnit}>%</span>
        </label>

        <KeyframeButton clip={clip} keys={['opacity']} />
      </div>
    </>
  )
}

const AudioClipProperties = ({ clip }: SubComponentProps<EditView.AudioClip>) => {
  const { t } = useI18n()
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
      <h2 class={styles.panelHeading}>{t('audio_properties')}</h2>

      <h3 id={headingId} class={styles.panelSubheading}>
        {t('prop_volume')}
      </h3>

      <div class={styles.inputRow}>
        <input type="range" {...volumeInputProps} />

        <label class={[styles.numberInput, styles.asText]}>
          <input type="number" {...volumeInputProps} />
          <span class={styles.inputUnit}>%</span>
        </label>

        <KeyframeButton clip={clip} keys={['volume']} />
      </div>
    </>
  )
}
