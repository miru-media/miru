// eslint-disable-next-line import/no-unresolved -- glob
import * as _frags from './glsl/*.frag'
import type { EffectOp } from './types/core'

export const FRAGMENT_SHADERS = _frags as unknown as Record<EffectOp['type'], string>
