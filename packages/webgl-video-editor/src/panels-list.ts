import { AssetBin } from '#constants'
import type { VideoEditor } from '#core'

import { AssetBinAudio } from './components/asset-bin-audio.jsx'
import { AssetBinFilters } from './components/asset-bin-filters.jsx'
import { AssetBinFonts } from './components/asset-bin-fonts.jsx'
import { AssetBinVideo } from './components/asset-bin-video.jsx'

export const getPanelList = (editor: VideoEditor) =>
  [
    {
      id: AssetBin.audio,
      titleI18nKey: 'music',
      PanelBody: AssetBinAudio,
      Icon: IconMsMusicNoteRounded,
      isPermitted: undefined,
    },
    {
      id: AssetBin.video,
      titleI18nKey: 'media',
      PanelBody: AssetBinVideo,
      Icon: IconMsFolderOpenOutlineRounded,
      isPermitted: undefined,
    },
    {
      id: AssetBin.fonts,
      titleI18nKey: 'fonts',
      PanelBody: AssetBinFonts,
      Icon: IconMsTextFieldsRounded,
      isPermitted: undefined,
    },
    {
      id: AssetBin.filters,
      titleI18nKey: 'filters',
      PanelBody: AssetBinFilters,
      Icon: IconMsFilterVintageOutline,
      isPermitted: () => editor.selection?.isVideo() && editor.selection.isMediaClip(),
    },
  ] as const
