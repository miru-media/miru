import { AdjustmentsView } from '@/components/Adjustments'
import { CropView } from '@/components/Cropper'
import { FilterView } from '@/components/Filter'
import { SourcePreview } from '@/components/SourcePreview'

import { wrap } from './wrappers'

export { ImageEditorVue as ImageEditor } from './wrappers'
export const ImageEditorPreview = wrap(SourcePreview, 'miru-image-editor-preview')
export const ImageEditorCropper = wrap(CropView, 'miru-image-editor-cropper')
export const ImageEditorFilterMenu = wrap(FilterView, 'miru-image-editor-filter-menu')
export const ImageEditorAdjustmentsMenu = wrap(AdjustmentsView, 'miru-image-editor-adjustments-menu')
