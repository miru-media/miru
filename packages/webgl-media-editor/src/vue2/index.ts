import { AdjustmentsView } from '../components/adjustments'
import { CropView } from '../components/cropper'
import { FilterView } from '../components/filter'
import { SourcePreview } from '../components/source-preview'

import { wrap } from './wrappers'

export { MediaEditor } from '../wrapper'
export const MediaEditorPreview = wrap(SourcePreview, 'media-editor-preview')
export const MediaEditorCropper = wrap(CropView, 'media-editor-cropper')
export const MediaEditorFilterMenu = wrap(FilterView, 'media-editor-filter-menu')
export const MediaEditorAdjustmentsMenu = wrap(AdjustmentsView, 'media-editor-adjustments-menu')
