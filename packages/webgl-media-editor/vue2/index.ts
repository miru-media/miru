import { AdjustmentsView } from '../components/Adjustments'
import { CropView } from '../components/Cropper'
import { FilterView } from '../components/Filter'
import { SourcePreview } from '../components/SourcePreview'

import { wrap } from './wrappers'

export { MediaEditor as MediaEditor } from '../wrapper'
export const MediaEditorPreview = wrap(SourcePreview, 'media-editor-preview')
export const MediaEditorCropper = wrap(CropView, 'media-editor-cropper')
export const MediaEditorFilterMenu = wrap(FilterView, 'media-editor-filter-menu')
export const MediaEditorAdjustmentsMenu = wrap(AdjustmentsView, 'media-editor-adjustments-menu')
