import { Button } from 'shared/components/button'
import styles from '../css/index.module.css'
import { useEditor } from './utils'
import { Rational, useI18n } from 'shared/utils'
import type { Track } from '#core'


export const AssetBinFonts = () => {
    const editor = useEditor()
    const { t } = useI18n()

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
                    fontFamily: 'Ariel',
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
            </div>
        </div>
    )
}