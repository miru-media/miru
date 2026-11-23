/* eslint-disable no-alert -- TODO */
import { h, type Ref } from 'fine-jsx'

import { Drawer } from '#atoms'
import type { VideoEditor } from '#core'
import { LoadingOverlay } from 'shared/components/loading-overlay'
import type { I18nOptions } from 'shared/types'
import { provideI18n } from 'shared/utils'
import { assertEncoderConfigIsSupported, hasVideoDecoder } from 'shared/video/utils'

import {
  AssetBin,
  AUDIO_EXTENSIONS,
  AUDIO_MIME_TYPES,
  EXPORT_VIDEO_CODECS,
  IMAGE_MIME_TYPES,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_TYPES,
} from '../constants.ts'
import styles from '../css/index.module.css'
import { getPanelList } from '../panels-list.ts'

import { AssetDragCursor } from './asset-drag-cursor.jsx'
import { ClipProperties } from './clip-properties.jsx'
import { Debug } from './debug.jsx'
import { DesktopControls } from './desktop-controls.jsx'
import { MobileControls } from './mobile-controls.jsx'
import { MobileToolbar } from './mobile-toolbar.jsx'
import { PanelToolbar } from './panel-toolbar.jsx'
import { PlaybackControlsOverlay } from './playback-controls-overlay.jsx'
import { Timeline } from './timeline/timeline.jsx'
import { TransformControls } from './transform-controls.jsx'
import {
  type ImportMediaBin,
  importMediaFiles,
  provideEditor,
  provideImportMediaFiles,
  useDomDropzone,
} from './utils.ts'

export const VideoEditorUI = (props: {
  editor: VideoEditor
  children?: Record<string, Ref>
  i18n?: I18nOptions
  onClickHelp?: () => unknown
  importMediaFiles?: (bin: ImportMediaBin) => Promise<File[]>
}): JSX.Element => {
  const { editor } = props
  const i18n = provideI18n(props.i18n ?? { messages: {} })
  const { t } = i18n

  provideEditor(editor._editor)
  provideImportMediaFiles(props.importMediaFiles)

  if (hasVideoDecoder())
    Promise.all(
      EXPORT_VIDEO_CODECS.map((codec) =>
        assertEncoderConfigIsSupported('video', { codec, width: 1920, height: 1080 })
          .then(() => true)
          .catch(() => false),
      ),
    )
      .then((results) => {
        if (!results.some((supported) => supported)) {
          alert(`${t('error_cannot_export')} (${EXPORT_VIDEO_CODECS.join()})`)
        }
      })
      .catch(() => undefined)
  else alert(t('error_no_webcodecs'))

  const acceptMimes = new Set([...VIDEO_MIME_TYPES, ...IMAGE_MIME_TYPES, ...AUDIO_MIME_TYPES])
  const acceptExts = new Set([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS])
  useDomDropzone(editor._editor._workspaceContainer, {
    filter: (item) =>
      item.kind === 'file' &&
      /^(?:(?:image\/(?:png|jpeg)|video|audio)|application\/(?:ogg|octet-stream))/u.test(item.type),
    onDrop(_event, items) {
      const accepted = items
        .map((f) => f.getAsFile()!)
        .filter(
          ({ type, name }) => acceptMimes.has(type) || acceptExts.has(name.slice(name.lastIndexOf('.'))),
        )
      void importMediaFiles(editor, accepted, t).then((results) => {
        const newAssets = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
        if (!newAssets.length) return

        switch (editor.activeAssetBin) {
          case AssetBin.video:
            if (newAssets.some((asset) => asset.video)) return
            break
          case AssetBin.audio:
            if (newAssets.some((asset) => asset.type === 'asset:media:av' && !!asset.audio)) return
            break
          default:
        }

        const firstAsset = newAssets[0]

        switch (firstAsset.type) {
          case 'asset:media:av':
            if (firstAsset.video) editor.activeAssetBin = AssetBin.video
            else if (firstAsset.audio) editor.activeAssetBin = AssetBin.audio
            break
          case 'asset:media:image':
            editor.activeAssetBin = AssetBin.video
        }
      })
    },
  })

  const getSlot = (name: string, className = styles.slot) =>
    props.children?.[name] && <div class={className}>{props.children[name]}</div>

  return (
    <div
      ref={editor._editor._workspaceContainer}
      class={() => [
        styles.videoEditor,
        styles.workspace,
        editor.isMobileWorkspace ? styles.mobile : styles.desktop,
      ]}
      style={() => {
        const { width, height } = editor.doc.resolution
        return `
        --viewport-container-height:${editor.viewportContainerSize.height}px;
        --viewport-width:${editor.viewportSize.width}px;
        --viewport-height:${editor.viewportSize.height}px;
        --viewport-aspect-ratio:${width / height};`
      }}
    >
      {getSlot('header', styles.workspaceHeader)}

      {() =>
        !editor.isMobileWorkspace && (
          <PanelToolbar onClickHelp={props.onClickHelp}>{getSlot('toolbar')}</PanelToolbar>
        )
      }

      <>
        {getPanelList(editor).map(({ id, titleI18nKey, PanelBody, isPermitted }) => () => {
          if (!isPermitted.value) return

          if (editor.isMobileWorkspace)
            return <Drawer id={editor.getPartId(id)} title={t(titleI18nKey)} content={() => <PanelBody />} />

          return (
            editor.activeAssetBin === id && (
              <section class={styles.panel}>
                <PanelBody />
              </section>
            )
          )
        })}
      </>

      <div ref={editor._editor._viewportContainer} class={styles.workspaceViewportContainer}>
        <div ref={editor._editor._viewport} class={styles.workspaceViewport}>
          {h(editor.canvas, { class: styles.viewportCanvas })}
          <TransformControls />
          <LoadingOverlay loading={() => !editor.playback.isReady} />
        </div>
        {() => !editor.isMobileWorkspace && <PlaybackControlsOverlay />}
        {() => editor.isMobileWorkspace && <MobileControls />}
      </div>

      {() =>
        !editor.isMobileWorkspace && (
          <div class={styles.workspacePropertiesPositioner}>
            <ClipProperties />
          </div>
        )
      }

      <div class={styles.workspaceBottom}>
        {() => !editor.isMobileWorkspace && <DesktopControls />}

        <Timeline>{{ empty: props.children?.timelineEmpty }}</Timeline>
      </div>

      {() =>
        editor.isMobileWorkspace && (
          <MobileToolbar onClickHelp={props.onClickHelp}>{getSlot('toolbar')}</MobileToolbar>
        )
      }

      {() =>
        editor._showStats && (
          <div style="grid-area:debug">
            <Debug />
          </div>
        )
      }
      <AssetDragCursor />
    </div>
  )
}
