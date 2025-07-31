import { AdjustmentsView } from '../components/adjustments.jsx'
import { CropView } from '../components/cropper.jsx'
import { FilterView } from '../components/filter.jsx'
import { SourcePreview } from '../components/source-preview.jsx'

import { wrap } from './wrappers.ts'

export { MediaEditor } from '../wrapper.ts'
export const MediaEditorPreview = wrap(SourcePreview, 'media-editor-preview')
export const MediaEditorCropper = wrap(CropView, 'media-editor-cropper')
export const MediaEditorFilterMenu = wrap(FilterView, 'media-editor-filter-menu')
export const MediaEditorAdjustmentsMenu = wrap(AdjustmentsView, 'media-editor-adjustments-menu')
