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

import { ClipProperties } from './clip-properties.jsx'
import { Debug } from './debug.jsx'
import { DesktopControls } from './desktop-controls.jsx'
import { MobileControls } from './mobile-controls.jsx'
import { MobileToolbar } from './mobile-toolbar.jsx'
import { PanelToolbar } from './panel-toolbar.jsx'
import { DesktopPlaybackControls } from './playback-controls-overlay.jsx'
import { Timeline } from './timeline.jsx'
import { TransformControls } from './transform-controls.jsx'
import { provideEditor } from './utils.ts'

export const VideoEditorUI = (props: {
  editor: VideoEditor
  children?: Record<string, Ref>
  i18n?: I18nOptions
  onClickHelp?: () => unknown
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

  const getSlot = (name: string) =>
    props.children?.[name] && <div class={styles.slot}>{props.children[name]}</div>

  return (
    <div
      ref={editor._editor._workspaceContainer}
      class={() => [
        styles.videoEditor,
        styles.workspace,
        editor.isMobileWorkspace ? styles.mobile : styles.desktop,
      ]}
      style={() =>
        `--viewport-width:${editor.viewportSize.width}px;--viewport-height:${editor.viewportSize.height}px;`
      }
    >
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

      <div class={[styles.viewport, styles.workspaceViewport]}>
        {h(editor.canvas, { class: styles.viewportCanvas })}
        <TransformControls />
        <LoadingOverlay loading={() => !playback.isReady} />
        {() => !editor.isMobileWorkspace && <DesktopPlaybackControls />}
      </div>

      {() => editor.isMobileWorkspace && <MobileControls />}

      {() =>
        import.meta.env.DEV &&
        !editor.isMobileWorkspace && (
          <div class={styles.workspacePropertiesPositioner}>
            <ClipProperties />
          </div>
        )
      }

      <div class={styles.workspaceBottom}>
        {() => !editor.isMobileWorkspace && <DesktopControls />}

        <Timeline>{{ empty: props.children?.timelineEmpty }}</Timeline>

        {() =>
          editor.isMobileWorkspace && (
            <MobileToolbar onClickHelp={props.onClickHelp}>{getSlot('toolbar')}</MobileToolbar>
          )
        }

        <progress
          style={() => (editor.exportProgress >= 0 ? 'width:100%' : 'display:none')}
          value={() => editor.exportProgress}
        ></progress>

        {() => editor._showStats && <Debug />}
      </div>
    </div>
  )
}
