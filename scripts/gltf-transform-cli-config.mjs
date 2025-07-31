import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

import { CUSTOM_EXTENSIONS } from 'gltf-ar-effects/transform'

export default {
  extensions: [...ALL_EXTENSIONS, ...CUSTOM_EXTENSIONS],
}
