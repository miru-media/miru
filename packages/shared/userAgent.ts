import { win } from '@/utils/window'

const { userAgent = '' } = (win.navigator as Navigator | undefined) ?? {}
const majorVersion = /Version\/(\d+)/.exec(userAgent)?.[1]

const IS_CHROMIUM = userAgent.includes('Chrome/') || userAgent.includes('Chromium/')
export const IS_LIKE_MAC = userAgent.includes('Mac OS')
export const IS_SAFARI = userAgent.includes('AppleWebKit/') && userAgent.includes('Safari/') && !IS_CHROMIUM
export const IS_SAFARI_16 = IS_SAFARI && majorVersion === '16'
export const IS_SAFARI_17 = IS_SAFARI && majorVersion === '17'
export const IS_FIREFOX = userAgent.includes('Gecko/')

export const SUPPORTS_2D_OFFSCREEN_CANVAS =
  typeof OffscreenCanvas !== 'undefined' && (OffscreenCanvas as unknown) != null
// safari 16 only supports 2D offscreen canvas
export const FULLY_SUPPORTS_OFFSCREEN_CANVAS = !IS_SAFARI_16 && SUPPORTS_2D_OFFSCREEN_CANVAS
