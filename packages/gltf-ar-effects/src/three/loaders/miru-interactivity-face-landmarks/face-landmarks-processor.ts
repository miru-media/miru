import { type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
// eslint-disable-next-line import/default
import mediaPipeTasksVisionUrl from '@mediapipe/tasks-vision?url'
import modelAssetPath from 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
import * as THREE from 'three'

/* eslint-disable import/no-relative-packages */
import { promiseWithResolvers } from 'shared/utils'

import wasmLoaderPath from '../../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url'
import wasmBinaryPath from '../../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url'
/* eslint-enable import/no-relative-packages */
import { FACEMESH_VERTEX_INDICES, LANDMARKS_VERTEX_COUNT } from '../../../constants'

import {
  type WorkerErrorData,
  type WorkerFetchProgressData,
  type WorkerInitData,
  type WorkerInitResponse,
  type WorkerResultData,
} from './detector-worker'
// eslint-disable-next-line import/default
import DetectorWorker from './detector-worker?worker'

export interface FaceTransform {
  translation: number[]
  rotation: number[]
  scale: number[]
}

const WASM_FILESET = {
  wasmLoaderPath,
  wasmBinaryPath,
}

export class FaceLandmarksProcessor {
  onDetect: (faceTransforms: FaceTransform[]) => void
  onError: (error: unknown) => void
  timestamp = -1
  isDetecting = false
  result: FaceLandmarkerResult | undefined
  static isSync = false
  worker = new DetectorWorker()
  workerIsInitialized = false
  mirror = true
  tempVector = new THREE.Vector3()

  hasMirroredGeometry = false
  faceMeshGeometries: Record<number, THREE.BufferGeometry[] | undefined> = {}
  faceGeometryPositions: Record<number, THREE.Float32BufferAttribute | undefined> = {}
  faceGeometryIndex = new THREE.Uint16BufferAttribute(FACEMESH_VERTEX_INDICES, 1)

  // https:github.com/google-ai-edge/mediapipe/blob/232008b/mediapipe/tasks/cc/vision/face_geometry/face_geometry_from_landmarks_graph.cc#L71
  estimatedCamera = new THREE.PerspectiveCamera(63, 1, 1, 10_000)
  video?: HTMLVideoElement
  rvfcHandle = -1

  workerInit?: ReturnType<typeof promiseWithResolvers<void>>

  constructor(options: {
    onDetect: (faceTransforms: FaceTransform[]) => void
    onInitProgress: (progress: number) => void
    onError: (error: unknown) => void
  }) {
    this.onDetect = options.onDetect
    this.onError = options.onError
    const { onInitProgress } = options

    this.worker.addEventListener(
      'message',
      ({
        data,
      }: MessageEvent<WorkerInitResponse | WorkerResultData | WorkerErrorData | WorkerFetchProgressData>) => {
        switch (data.type) {
          case 'init-response': {
            if (data.error !== undefined) this.workerInit?.reject(data.error)
            else this.workerInit?.resolve()
            break
          }
          case 'fetch-progress': {
            onInitProgress(data.progress)
            break
          }
          case 'error': {
            alert(data.error)
            break
          }

          case 'result': {
            const { result } = data
            this.result = result

            this.onDetect(this._processResult(result))

            this.isDetecting = false
          }
        }
      },
    )
  }

  private async _init() {
    if (this.workerInit) return this.workerInit.promise

    const init: WorkerInitData = {
      type: 'INIT',
      wasmFileset: WASM_FILESET,
      mediaPipeTasksVisionUrl,
      modelAssetPath,
    }
    this.worker.postMessage(init)

    this.workerInit = promiseWithResolvers()
    await this.workerInit.promise
  }

  async start(video: HTMLVideoElement, mirror = true) {
    await this._init()
    this.video?.cancelVideoFrameCallback(this.rvfcHandle)
    this.video = video
    this.mirror = mirror

    if (video.readyState < video.HAVE_METADATA) {
      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve, { once: true })
        video.addEventListener('error', reject, { once: true })
      })
    }

    const { estimatedCamera } = this
    estimatedCamera.aspect = video.videoWidth / video.videoHeight
    estimatedCamera.updateProjectionMatrix()

    const onVideoFrame: VideoFrameRequestCallback = () => {
      this.detect().catch(this.onError)
      this.rvfcHandle = video.requestVideoFrameCallback(onVideoFrame)
    }
    this.rvfcHandle = video.requestVideoFrameCallback(onVideoFrame)
  }

  async detect() {
    const { isDetecting, video } = this

    if (isDetecting || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

    const timestamp = performance.now()

    try {
      this.isDetecting = true
      const image = await createImageBitmap(video)
      this.worker.postMessage({ type: 'frame', image, timestamp }, [image])
    } catch (error) {
      this.onError(error)
      this.isDetecting = false
    }
  }

  // TODO: run in worker?
  private _processResult(result: FaceLandmarkerResult | undefined): FaceTransform[] {
    const faceTransforms: FaceTransform[] = []

    if (!result) return faceTransforms

    const { faceLandmarks, facialTransformationMatrixes } = result
    const { estimatedCamera, mirror, tempVector: vector } = this

    for (let faceIndex = 0, facesLength = faceLandmarks.length; faceIndex < facesLength; faceIndex++) {
      const landmarks = faceLandmarks[faceIndex]

      const facialMatrix = new THREE.Matrix4().fromArray(facialTransformationMatrixes[faceIndex].data)
      const facePosition = new THREE.Vector3().setFromMatrixPosition(facialMatrix)
      const faceRotationQuat = new THREE.Quaternion().setFromRotationMatrix(facialMatrix)
      const faceScale = new THREE.Vector3().setFromMatrixScale(facialMatrix)

      if (mirror) {
        facePosition.x *= -1

        {
          const { x, y, z, w } = faceRotationQuat
          faceRotationQuat.set(-x, -y, z, -w)
        }
      }

      const rotationToOrigin = new THREE.Euler().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(estimatedCamera.position, facePosition, estimatedCamera.up),
      )

      // Try to resolve some issues with the transform matrix rotation and the face mesh distortion
      // https://github.com/google-ai-edge/mediapipe/issues/4759
      facialMatrix
        .multiply(new THREE.Matrix4().makeShear(0, 0, 0, 0, -rotationToOrigin.y / 2, 0))
        .multiply(
          new THREE.Matrix4().makeTranslation(
            new THREE.Vector3(rotationToOrigin.y + new THREE.Euler().setFromQuaternion(faceRotationQuat).y),
          ),
        )

      // https:github.com/google-ai-edge/mediapipe/blob/232008b/mediapipe/tasks/cc/vision/face_geometry/data/canonical_face_model_uv_visualization.png
      const referenceRight = landmarks[227]
      const referenceLeft = landmarks[447]
      vector.set(0, 0, ((referenceRight.z + referenceLeft.z) / 2) * estimatedCamera.aspect)
      vector.unproject(estimatedCamera)
      const scale = facePosition.z / vector.z

      const faceVertices = this.getFaceGeometryPosition(faceIndex).array

      let offset = 0
      for (let i = 0; i < LANDMARKS_VERTEX_COUNT; i++) {
        const landmark = landmarks[i]

        vector.x = (landmark.x * +2 - 1) * (mirror ? -1 : 1)
        vector.y = landmark.y * -2 + 1
        vector.z = landmark.z * estimatedCamera.aspect

        vector.unproject(estimatedCamera)

        faceVertices[offset + 0] = vector.x * scale
        faceVertices[offset + 1] = vector.y * scale
        faceVertices[offset + 2] = vector.z * scale

        offset += 3
      }

      this.updateFaceGeometries(faceIndex, mirror)
      let maybeMirroredRotation

      if (mirror) {
        maybeMirroredRotation = faceRotationQuat.clone()
        const { x, y, z, w } = faceRotationQuat
        maybeMirroredRotation.set(x, -y, z, w)
      } else maybeMirroredRotation = faceRotationQuat

      faceTransforms.push({
        translation: facePosition.toArray(),
        rotation: maybeMirroredRotation.toArray(),
        scale: faceScale.toArray(),
      })
    }

    return faceTransforms
  }

  getFaceGeometryPosition(faceIndex: number) {
    return (this.faceGeometryPositions[faceIndex] ??= new THREE.Float32BufferAttribute(
      LANDMARKS_VERTEX_COUNT * 3,
      3,
    ))
  }

  addFaceGeometry(faceId: number, geometry: THREE.BufferGeometry) {
    geometry.setAttribute('position', this.getFaceGeometryPosition(faceId))
    geometry.attributes.position.needsUpdate = true
    geometry.setIndex(this.faceGeometryIndex)
    geometry.computeVertexNormals()
    ;(this.faceMeshGeometries[faceId] ??= []).push(geometry)
  }

  updateFaceGeometries(faceId: number, mirror: boolean) {
    if (this.hasMirroredGeometry !== mirror) {
      const { array } = this.faceGeometryIndex
      let temp
      for (let i = 0, length = array.length; i < length; i += 3) {
        temp = array[i]
        array[i] = array[i + 2]
        array[i + 2] = temp
      }
      this.hasMirroredGeometry = mirror
    }

    this.faceMeshGeometries[faceId]?.forEach((geometry) => {
      geometry.computeVertexNormals()
      geometry.getAttribute('position').needsUpdate = true
    })
  }

  dispose() {
    this.worker.terminate()
    this.video?.cancelVideoFrameCallback(this.rvfcHandle)
  }
}
