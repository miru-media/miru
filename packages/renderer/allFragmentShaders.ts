import { type EffectOp } from 'shared/types'

// eslint-disable-next-line import/no-unresolved -- glob
import * as _frags from './glsl/*.frag'

export const FRAGMENT_SHADERS = _frags as unknown as Record<EffectOp['type'], string>
