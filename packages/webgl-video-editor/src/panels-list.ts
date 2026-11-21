import { computed, ref } from 'fine-jsx'

import { AssetBin as AssetBinType } from '#constants'
import type { VideoEditor } from '#core'

import * as AssetBin from './components/asset-bin/index.ts'

const TRUE_REF = ref(true)

export const getPanelList = (editor: VideoEditor) =>
  [
    {
      id: AssetBinType.audio,
      titleI18nKey: 'music',
      PanelBody: AssetBin.Audio,
      Icon: IconMsMusicNoteRounded,
      isForSelection: false,
      isPermitted: TRUE_REF,
    },
    {
      id: AssetBinType.video,
      titleI18nKey: 'media',
      PanelBody: AssetBin.Video,
      Icon: IconMsFolderOpenOutlineRounded,
      isForSelection: false,
      isPermitted: TRUE_REF,
    },
    {
      id: AssetBinType.fonts,
      titleI18nKey: 'fonts',
      PanelBody: AssetBin.Fonts,
      Icon: IconMsTextFieldsRounded,
      isForSelection: false,
      isPermitted: TRUE_REF,
    },
    {
      id: AssetBinType.filters,
      titleI18nKey: 'filters',
      PanelBody: AssetBin.Filters,
      Icon: IconMsFilterVintageOutline,
      isForSelection: true,
      isPermitted: computed(() => {
        const { selection } = editor
        return selection?.isNode && selection.isVideo()
      }),
    },
  ] as const
