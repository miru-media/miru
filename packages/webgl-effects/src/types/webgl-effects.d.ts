import type * as twgl from 'twgl.js'

export { Renderer, Effect } from './classes.ts'
export type * from './core.ts'

export declare const getDefaultFilterDefinitions: (assetsPath?: string) => EffectDefinition[]

export declare const SOURCE_TEX_OPTIONS: twgl.TextureOptions
export declare const LUT_TEX_OPTIONS: twgl.TextureOptions
export declare const FRAMEBUFFER_TEX_OPTIONS: twgl.TextureOptions
