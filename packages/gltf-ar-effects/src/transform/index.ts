import { Interactivity } from './interactivity.ts'
import { MIRUMeshOccluder } from './mesh-occluder.ts'
import { InteractivityFaceLandmarks } from './miru-interactivity-face-landmarks.ts'
import { KHRNodeVisibility } from './node-visibility.ts'

export {
  KHR_INTERACTIVITY,
  MIRU_INTERACTIVITY_FACE_LANDMARKS,
  MAX_LANDMARK_FACES,
  LANDMARKS_VERTEX_COUNT,
  LandmarkOps,
} from '../constants.ts'

export const CUSTOM_EXTENSIONS = [
  InteractivityFaceLandmarks,
  Interactivity,
  MIRUMeshOccluder,
  KHRNodeVisibility,
]

export { InteractivityFaceLandmarks, Interactivity, MIRUMeshOccluder, KHRNodeVisibility }
