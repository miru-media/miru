import { computed, ref } from 'fine-jsx'

import { AssetBin } from '#constants'
import type { VideoEditor } from '#core'

import { AssetBinAudio } from './components/asset-bin-audio.jsx'
import { AssetBinFilters } from './components/asset-bin-filters.jsx'
import { AssetBinFonts } from './components/asset-bin-fonts.jsx'
import { AssetBinVideo } from './components/asset-bin-video.jsx'

const TRUE_REF = ref(true)

export const getPanelList = (editor: VideoEditor) =>
  [
    {
      id: AssetBin.audio,
      titleI18nKey: 'music',
      PanelBody: AssetBinAudio,
      Icon: IconMsMusicNoteRounded,
      isForSelection: false,
      isPermitted: TRUE_REF,
    },
    {
      id: AssetBin.video,
      titleI18nKey: 'media',
      PanelBody: AssetBinVideo,
      Icon: IconMsFolderOpenOutlineRounded,
      isForSelection: false,
      isPermitted: TRUE_REF,
    },
    {
      id: AssetBin.fonts,
      titleI18nKey: 'fonts',
      PanelBody: AssetBinFonts,
      Icon: IconMsTextFieldsRounded,
      isForSelection: false,
      isPermitted: TRUE_REF,
    },
    {
      id: AssetBin.filters,
      titleI18nKey: 'filters',
      PanelBody: AssetBinFilters,
      Icon: IconMsFilterVintageOutline,
      isForSelection: true,
      isPermitted: computed(() => {
        const { selection } = editor
        return selection?.isNode && selection.isVideo() && selection.isMediaClip()
      }),
    },
  ] as const
