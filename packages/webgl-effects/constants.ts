import type * as twgl from 'twgl.js'

import * as GL from './GL'

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
