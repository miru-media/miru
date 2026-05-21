import { computed } from 'fine-jsx'

import {
  DEFAULT_FILL_COLOR,
  DEFAULT_FONT_FAMILY,
  FONT_FAMILIES,
  FONT_WEIGHT_BOLD,
  FONT_WEIGHT_NORMAL,
} from '#constants'
import type { Track } from '#core'
import { Button } from 'shared/components/button'
import { Rational, useI18n } from 'shared/utils'

import styles from '../css/index.module.css'

import { useEditor } from './utils.ts'

const ALIGNMENTS = [
  { value: 'left', icon: 'i-tabler:align-left', labelKey: 'asset_bin_fonts_align_left' },
  { value: 'center', icon: 'i-tabler:align-center', labelKey: 'asset_bin_fonts_align_center' },
  { value: 'right', icon: 'i-tabler:align-right', labelKey: 'asset_bin_fonts_align_right' },
] as const

export const AssetBinFonts = () => {
  const editor = useEditor()
  const { t } = useI18n()

  const activeTextClip = computed(() => (editor.selection?.isTextClip() ? editor.selection : undefined))

  const closeAssetbin = () => {
    editor.activeAssetBin = null
  }

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
    <div class={styles.assetBin}>
      <div class={styles.assetBinHeader}>
        <Button onClick={closeAssetbin} label={t('asset_bin_fonts_close')} class={styles.textGreat}>
          <div class="bulma-icon i-tabler:x" />
        </Button>
        <h2 class={styles.textGreat}>{t('fonts')}</h2>
      </div>
      <div class={styles.assetBinInputContainer}>
        <button onClick={createClip} class={[styles.assetBinUpload, styles.textBodyBold]}>
          <div class="bulma-icon i-tabler:circle-plus" />
          <span>{t('asset_bin_fonts_add')}</span>
        </button>
        <div class={styles.assetBinFontsContainer}>
          {() => {
            const clip = activeTextClip.value
            return (
              clip && (
                <>
                  <div class={styles.assetBinSettingsSection}>
                    <h3 class={styles.textBodyBold}>{t('fonts')}</h3>
                    <input
                      type="text"
                      value={() => clip.content}
                      onInput={onTextContentChange}
                      aria-label={t('asset_bin_fonts_content')}
                      placeholder={t('asset_bin_fonts_content')}
                      class={styles.assetBinFontsContentInput}
                    />
                  </div>
                  <div class={styles.assetBinSettingsSection}>
                    <h3 class={styles.textBodyBold}>{t('asset_bin_fonts_text_settings')}</h3>
                    <select
                      value={() => clip.fontFamily}
                      onInput={onFontFamilyChange}
                      aria-label={t('asset_bin_fonts_select_family')}
                      class={styles.assetBinFontsSelect}
                    >
                      {FONT_FAMILIES.map((family) => (
                        <option value={family}>{family}</option>
                      ))}
                    </select>
                    <div class={styles.assetBinFontsPropContainer}>
                      <div class={styles.assetBinFontsSize}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={() => String(clip.fontSize)}
                          onInput={onFontSizeChange}
                          aria-label={t('asset_bin_fonts_size')}
                          class={styles.assetBinFontsSizeInput}
                        />
                        <span class={styles.assetBinFontsSizeUnit}>px</span>
                      </div>
                      <div class={styles.assetBinFontsStyle}>
                        <button
                          type="button"
                          onClick={onFontWeightToggle}
                          class={[
                            styles.assetBinSanitize,
                            styles.assetBinFontsStyleButton,
                            clip.fontWeight === FONT_WEIGHT_BOLD && styles.assetBinFontsStyleButtonActive,
                          ]}
                          aria-label={t('asset_bin_fonts_bold')}
                          aria-pressed={clip.fontWeight === FONT_WEIGHT_BOLD}
                        >
                          <div class="bulma-icon i-tabler:bold" />
                        </button>
                        <button
                          type="button"
                          onClick={onFontstyleToggle}
                          class={[
                            styles.assetBinSanitize,
                            styles.assetBinFontsStyleButton,
                            clip.fontStyle === 'italic' && styles.assetBinFontsStyleButtonActive,
                          ]}
                          aria-label={t('asset_bin_fonts_italic')}
                          aria-pressed={clip.fontStyle === 'italic'}
                        >
                          <div class="bulma-icon i-tabler:italic" />
                        </button>
                      </div>
                    </div>
                    <div class={styles.assetBinTextAlignContainer} role="group">
                      {ALIGNMENTS.map(({ value, icon, labelKey }) => (
                        <button
                          type="button"
                          onClick={() => onTextAlignChange(value)}
                          class={[
                            styles.assetBinSanitize,
                            styles.assetBinFontsStyleButton,
                            clip.align === value && styles.assetBinFontsStyleButtonActive,
                          ]}
                          aria-label={t(labelKey)}
                          aria-pressed={clip.align === value}
                        >
                          <div class={[`bulma-icon`, icon]} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div class={styles.assetBinSettingsSection}>
                    <h3 class={styles.textBodyBold}>{t('asset_bin_fonts_color_settings')}</h3>
                    <input
                      type="color"
                      value={() => clip.fill ?? DEFAULT_FILL_COLOR}
                      onInput={onFillColorChange}
                      aria-label={t('asset_bin_fonts_color_settings')}
                    />
                  </div>
                </>
              )
            )
          }}
        </div>
      </div>
    </div>
  )
}
