import { computed } from 'fine-jsx'

import {
  DEFAULT_FILL_COLOR,
  DEFAULT_FONT_FAMILY,
  FONT_FAMILIES,
  FONT_WEIGHT_BOLD,
  FONT_WEIGHT_NORMAL,
} from '#constants'
import type { Track } from '#core'
import { Rational, useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

const ALIGNMENTS = [
  { value: 'left', Icon: IconMsFormatAlignLeftRounded, labelKey: 'asset_bin_fonts_align_left' },
  { value: 'center', Icon: IconMsFormatAlignCenterRounded, labelKey: 'asset_bin_fonts_align_center' },
  { value: 'right', Icon: IconMsFormatAlignRightRounded, labelKey: 'asset_bin_fonts_align_right' },
] as const

export const AssetBinFonts = () => {
  const editor = useEditor()
  const { t } = useI18n()

  const activeTextClip = computed(() => (editor.selection?.isTextClip() ? editor.selection : undefined))

  const createClip = () => {
    try {
      let firstVideoTrack: Track | undefined
      let targetTrack: Track | undefined

      // use the first video track only if there are multiple video tracks in the timeline
      for (const track of editor.tracks) {
        if (track.isVideo()) {
          if (firstVideoTrack) {
            targetTrack = firstVideoTrack
            break
          } else firstVideoTrack = track
        }
      }
      // otherwise create and use a new track
      targetTrack ??= editor.addTrack('video')

      editor._transact(() => {
        const clip = editor.doc.createNode({
          id: editor.generateId(),
          type: 'clip:text',
          sourceStart: Rational.fromDecimal(0, editor.doc.frameRate),
          duration: Rational.fromDecimal(3, editor.doc.frameRate),
          content: 'hello world',
          fontFamily: DEFAULT_FONT_FAMILY,
          fontSize: 96,
          inlineSize: editor.doc.resolution.width,
          fill: '#ffffff',
          stroke: '#000000',
          // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- TODO
          translate: { x: editor.doc.resolution.width * 0.1, y: editor.doc.resolution.height * 0.01 },
          scale: { x: 1, y: 1 },
          rotate: 0,
        })

        clip.move({ parentId: targetTrack.id, index: targetTrack.clipCount })
        editor.select(clip)
      })
    } catch {
      // eslint-disable-next-line no-alert -- TODO
      alert(t('error_cannot_create_clip'))
    }
  }

  const onTextContentChange = (event: InputEvent) => {
    const clip = activeTextClip.value
    if (!clip) return
    clip.content = (event.target as HTMLInputElement).value
  }

  const onFontFamilyChange = (event: InputEvent) => {
    const clip = activeTextClip.value
    if (!clip) return
    const { value } = event.target as HTMLSelectElement
    clip.fontFamily = value
  }

  const onFontSizeChange = (event: InputEvent) => {
    const clip = activeTextClip.value
    if (!clip) return
    const value = Number((event.target as HTMLInputElement).value)
    if (!Number.isFinite(value) || value <= 0) return
    clip.fontSize = value
  }

  const onFontWeightToggle = () => {
    const clip = activeTextClip.value
    if (!clip) return
    clip.fontWeight = clip.fontWeight >= FONT_WEIGHT_BOLD ? FONT_WEIGHT_NORMAL : FONT_WEIGHT_BOLD
  }

  const onFontstyleToggle = () => {
    const clip = activeTextClip.value
    if (!clip) return
    clip.fontStyle = clip.fontStyle === 'italic' ? 'normal' : 'italic'
  }

  const onTextAlignChange = (align: 'left' | 'center' | 'right') => {
    const clip = activeTextClip.value
    if (!clip) return
    clip.align = align
  }

  const onFillColorChange = (event: InputEvent) => {
    const clip = activeTextClip.value
    if (!clip) return
    const color = (event.target as HTMLInputElement).value
    editor._transact(() => {
      clip.fill = color
      clip.stroke = color
    })
  }

  return (
    <div class={styles.panelBody}>
      <button onClick={createClip} class={[styles.wideButton, styles.textBodyBold]}>
        <IconMsAddCircleOutlineRounded />
        <span>{t('asset_bin_fonts_add')}</span>
      </button>

      {() => {
        const clip = activeTextClip.value
        const getFillColor = () => clip?.fill ?? DEFAULT_FILL_COLOR

        return (
          clip && (
            <>
              <div style="width:100%">
                <h3 class={styles.textBodyBold}>{t('fonts')}</h3>
                <textarea
                  value={() => clip.content}
                  onInput={onTextContentChange}
                  aria-label={t('asset_bin_fonts_content')}
                  placeholder={t('asset_bin_fonts_content')}
                  rows={1}
                  class={styles.panelInput}
                />
              </div>

              <h3 class={styles.textBodyBold}>{t('asset_bin_fonts_text_settings')}</h3>
              <select
                value={() => clip.fontFamily}
                onInput={onFontFamilyChange}
                aria-label={t('asset_bin_fonts_select_family')}
                class={styles.dropdownTrigger}
                style="width:100%"
              >
                {FONT_FAMILIES.map((family) => (
                  <option value={family}>{family}</option>
                ))}
              </select>

              <div class={styles.inputRow}>
                <label class={[styles.numberInput, styles.asText]}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={() => String(clip.fontSize)}
                    onInput={onFontSizeChange}
                    aria-label={t('asset_bin_fonts_size')}
                  />
                  <span class={styles.inputSuffix}>px</span>
                </label>
                <div class={styles.controlGroup} role="group">
                  <button
                    type="button"
                    onClick={onFontWeightToggle}
                    class={[clip.fontWeight === FONT_WEIGHT_BOLD && styles.assetBinFontsStyleButtonActive]}
                    aria-label={t('asset_bin_fonts_bold')}
                    aria-pressed={clip.fontWeight === FONT_WEIGHT_BOLD}
                  >
                    <IconMsFormatBoldRounded />
                  </button>
                  <button
                    type="button"
                    onClick={onFontstyleToggle}
                    class={[clip.fontStyle === 'italic' && styles.assetBinFontsStyleButtonActive]}
                    aria-label={t('asset_bin_fonts_italic')}
                    aria-pressed={clip.fontStyle === 'italic'}
                  >
                    <IconMsFormatItalicRounded />
                  </button>
                </div>
              </div>

              <div class={styles.controlGroup} role="group">
                {ALIGNMENTS.map(({ value, Icon, labelKey }) => (
                  <button
                    type="button"
                    onClick={() => onTextAlignChange(value)}
                    class={() => clip.align === value && styles.assetBinFontsStyleButtonActive}
                    aria-label={t(labelKey)}
                    aria-pressed={() => clip.align === value}
                  >
                    <Icon />
                  </button>
                ))}
              </div>
              <div>
                <h3 class={styles.textBodyBold}>{t('asset_bin_fonts_color_settings')}</h3>
                <label class={styles.input}>
                  <input
                    type="color"
                    colorspace="limited-srgb"
                    value={getFillColor}
                    onInput={onFillColorChange}
                    aria-label={t('asset_bin_fonts_color_settings')}
                    class={styles.srOnly}
                  />
                  <span style={() => `color:${getFillColor()}`}>&#11044;</span>
                  {getFillColor}
                </label>
              </div>
            </>
          )
        )
      }}
    </div>
  )
}
