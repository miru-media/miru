import { IS_LIKE_MAC, IS_SAFARI_16, IS_SAFARI_17 } from 'shared/userAgent'
import { assertCanExtractVideoFrames } from 'shared/video/utils'

import type * as pub from './types/media-trimmer'

const hasVideoEncoder = () => typeof VideoEncoder === 'function'

export const hasRequiredApis: typeof pub.hasRequiredApis = () => {
  try {
    assertHasRequiredApis()
    return true
  } catch {
    return false
  }
}

export const assertHasRequiredApis: typeof pub.assertHasRequiredApis = () => {
  if ((IS_SAFARI_16 || IS_SAFARI_17) && IS_LIKE_MAC)
    throw new Error(`VideoEncoder doesn't work on Safari <= 17.`)

  assertCanExtractVideoFrames()
  if (!hasVideoEncoder()) throw new Error('Missing VideoEncoder support.')
}
