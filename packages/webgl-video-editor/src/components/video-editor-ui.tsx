/* eslint-disable no-alert -- TODO */
import type { Ref } from 'fine-jsx'
import { h } from 'fine-jsx/jsx-runtime'

import { Drawer } from '#atoms'
import type { VideoEditor } from '#core'
import { LoadingOverlay } from 'shared/components/loading-overlay'
import type { I18nOptions } from 'shared/types'
import { provideI18n } from 'shared/utils'
import { assertEncoderConfigIsSupported, hasVideoDecoder } from 'shared/video/utils'

import { EXPORT_VIDEO_CODECS } from '../constants.ts'
import styles from '../css/index.module.css'
import { getPanelList } from '../panels-list.ts'

import { Debug } from './debug.jsx'
import { DesktopControls } from './desktop-controls.jsx'
import { PanelToolbar } from './panel-toolbar.jsx'
import { PlaybackControls } from './playback-controls.jsx'
import { Timeline } from './timeline.jsx'
import { TransformControls } from './transform-controls.jsx'
import { provideEditor } from './utils.ts'

export const VideoEditorUI = (props: {
  editor: VideoEditor
  children?: Record<string, Ref>
  i18n?: I18nOptions
}): JSX.Element => {
  const { editor } = props
  const i18n = provideI18n(props.i18n ?? { messages: {} })
  const { t } = i18n

  provideEditor(editor._editor)

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

  const { playback } = editor

  return (
    <div
      ref={editor._editor._workspaceContainer}
      class={() => [
        styles.videoEditor,
        styles.workspace,
        editor.isMobileWorkspace ? styles.mobile : styles.desktop,
      ]}
    >
      <div class={styles.workspaceHeader}>Header</div>

      <div class={styles.panels}>
        {/* TODO: I'm using fragments here to keep the number of children stable. Need to fix it in fine-jsx */}
        <>{() => !editor.isMobileWorkspace && <PanelToolbar />}</>

        <>
          {getPanelList(editor).map(({ id, titleI18nKey, PanelBody, isPermitted = () => true }) => () => {
            if (!isPermitted()) return
            if (editor.isMobileWorkspace)
              return (
                <Drawer id={editor.getPartId(id)} title={t(titleI18nKey)} content={() => <PanelBody />} />
              )

            return (
              editor.activeAssetBin === id && (
                <div class={styles.panel}>
                  <PanelBody />
                </div>
              )
            )
          })}
        </>
      </div>

      <div
        class={[styles.viewport, styles.workspaceViewport]}
        style={() =>
          `--viewport-width:${editor.viewportSize.width}px;--viewport-height:${editor.viewportSize.height}px;`
        }
      >
        {h(editor.canvas, { class: styles.viewportCanvas })}
        <TransformControls />
        <LoadingOverlay loading={() => !playback.isReady} />
        <PlaybackControls />
      </div>

      <div class={styles.workspaceProperties}>Transform</div>

      <div class={styles.workspaceBottom}>
        {() => (editor.isMobileWorkspace ? null : <DesktopControls />)}

        <Timeline>{{ empty: props.children?.timelineEmpty }}</Timeline>

        <div class={styles.slot}>{props.children?.default}</div>

        <progress
          style={() => (editor.exportProgress >= 0 ? 'width:100%' : 'display:none')}
          value={() => editor.exportProgress}
        ></progress>

        {() => editor._showStats && <Debug />}
      </div>
    </div>
  )
}
