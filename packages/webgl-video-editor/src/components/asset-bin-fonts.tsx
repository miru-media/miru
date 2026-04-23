import { Button } from 'shared/components/button'
import styles from '../css/index.module.css'
import { useEditor } from './utils'
import { Rational, useI18n } from 'shared/utils'
import type { Track } from '#core'
import { computed } from 'fine-jsx'
import { DEFAULT_FONT_FAMILY, FONT_FAMILIES, FONT_WEIGHT_BOLD, FONT_WEIGHT_NORMAL } from '#constants'


export const AssetBinFonts = () => {
    const editor = useEditor()
    const { t } = useI18n()

    const activeTextClip = computed(() => (editor.selection?.isTextClip() ? editor.selection : undefined))

    const closeAssetbin = () => {
      editor.activeAssetBin = null
    }

    const createClip = () => {
        try {
            const track: Track = editor.tracks.find((track) => track.trackType === 'text') ?? editor.addTrack('text')
            const clip = editor._transact(() => {
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
                    translate: { x: editor.doc.resolution.width * 0.1, y: editor.doc.resolution.height * 0.01},
                    scale: { x: 1, y: 1},
                    rotate: 0
                })
                clip.move({ parentId: track.id, index: track.clipCount})
                return clip
            })

            editor.select(clip)
        } catch {
            // eslint-disable-next-line no-alert -- TODO
            alert(t('error_cannot_create_clip'))
        }
    }

    const onFontFamilyChange = (event: InputEvent) => {
        const clip = activeTextClip.value
        if (!clip) return
        const value = (event.target as HTMLSelectElement).value
        editor._transact(() => { clip.fontFamily = value })
    }

    const onFontSizeChange = (event: InputEvent) => {
        const clip = activeTextClip.value
        if (!clip) return
        const value = Number((event.target as HTMLInputElement).value)
        if (!Number.isFinite(value) || value <= 0) return
        editor._transact(() => { clip.fontSize = value})
    }

    const onFontWeightToggle = () => {
        const clip = activeTextClip.value
        if (!clip) return
        editor._transact(() => { clip.fontWeight = clip.fontWeight >= FONT_WEIGHT_BOLD ? FONT_WEIGHT_NORMAL : FONT_WEIGHT_BOLD })
    }

    const onFontstyleToggle = () => {
        const clip = activeTextClip.value
        if (!clip) return
        editor._transact(() => { clip.fontStyle = clip.fontStyle === 'italic' ? 'normal' : 'italic'})
    }

    const onTextAlignChange = (align: 'left' | 'center' | 'right') => {
        const clip = activeTextClip.value
        if (!clip) return
        editor._transact(() => { clip.align = align })
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
                        return clip && (
                            <>
                                <select 
                                    value={() => clip.fontFamily}
                                    onInput={onFontFamilyChange}
                                    aria-label={t('asset_bin_fonts_select_family')}
                                    class={styles.assetBinFontsSelect}
                                >
                                    {FONT_FAMILIES.map((family) => (
                                        <option value={family}>
                                            {family}
                                        </option>
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
                                            class={[styles.assetBinSanitize, styles.assetBinFontsStyleButton, clip.fontWeight === FONT_WEIGHT_BOLD && styles.assetBinFontsStyleButtonActive ]}
                                            aria-label={t('asset_bin_fonts_bold')}
                                        >
                                            <div class="bulma-icon i-tabler:bold" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onFontstyleToggle}
                                            class={[styles.assetBinSanitize, styles.assetBinFontsStyleButton, clip.fontStyle === 'italic' && styles.assetBinFontsStyleButtonActive]}
                                            aria-label={t('asset_bin_fonts_italic')}
                                        >
                                            <div class="bulma-icon i-tabler:italic" />
                                        </button>
                                    </div>
                                </div>
                                <div class={styles.assetBinTextAlignContainer}>
                                    <button
                                        type="button"
                                        onClick={() => onTextAlignChange('left')}
                                        class={[styles.assetBinSanitize, styles.assetBinFontsStyleButton, clip.align === 'left' && styles.assetBinFontsStyleButtonActive]}
                                        aria-label={t('asset_bin_fonts_align_left')}
                                    >
                                        <div class="bulma-icon i-tabler:align-left"/>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onTextAlignChange('center')}
                                        class={[styles.assetBinSanitize, styles.assetBinFontsStyleButton, clip.align === 'center' && styles.assetBinFontsStyleButtonActive]}
                                        aria-label={t('asset_bin_fonts_align_center')}
                                    >
                                        <div class="bulma-icon i-tabler:align-center"/>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onTextAlignChange('right')}
                                        class={[styles.assetBinSanitize, styles.assetBinFontsStyleButton, clip.align === 'right' && styles.assetBinFontsStyleButtonActive]}
                                        aria-label={t('asset_bin_fonts_align_right')}
                                    >
                                        <div class="bulma-icon i-tabler:align-right"/>
                                    </button>
                                </div>
                            </>
                        )
                    }}
                </div>
            </div>
        </div>
    )
}