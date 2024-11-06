import type * as twgl from 'twgl.js'

import * as GL from '@/GL'
import { win } from '@/utils/window'

export * as EffectOpType from '@/editor/EffectOpType'

const { userAgent = '' } = (win.navigator as Navigator | undefined) ?? {}
export const IS_SAFARI_16 = userAgent.includes('AppleWebKit/') && userAgent.includes('Version/16.')
export const IS_FIREFOX = userAgent.includes('Gecko/')

export const SUPPORTS_2D_OFFSCREEN_CANVAS =
  typeof OffscreenCanvas !== 'undefined' && (OffscreenCanvas as unknown) != null
// safari 16 only supports 2D offscreen canvas
export const FULLY_SUPPORTS_OFFSCREEN_CANVAS = !IS_SAFARI_16 && SUPPORTS_2D_OFFSCREEN_CANVAS

export const MAX_EFFECT_OPS = 10
export const MAX_EFFECT_TEXTURES = 7

export const DEFAULT_INTENSITY = 1

export const SOURCE_TEX_OPTIONS = {
  target: GL.TEXTURE_2D,
  flipY: 0,
  wrap: GL.CLAMP_TO_EDGE,
  min: GL.LINEAR,
  mag: GL.LINEAR,
  auto: false,
} satisfies twgl.TextureOptions

export const LUT_TEX_OPTIONS = {
  target: GL.TEXTURE_3D,
  flipY: 0,
  wrap: GL.CLAMP_TO_EDGE,
  min: GL.LINEAR,
  mag: GL.LINEAR,
  colorspaceConversion: GL.NONE,
  auto: false,
} satisfies twgl.TextureOptions

export const FRAMEBUFFER_TEX_OPTIONS = {
  target: GL.TEXTURE_2D,
  wrap: GL.CLAMP_TO_EDGE,
  min: GL.LINEAR,
  mag: GL.LINEAR,
  auto: false,
} satisfies twgl.TextureOptions

export const SCROLL_SELECT_EVENT_THROTTLE_MS = 40
export const SCROLL_SELECT_TIMEOUT_MS = 300

export const MOBILE_MAX_WIDTH = 640

export const MIN_CLIP_DURATION_S = 0.25
