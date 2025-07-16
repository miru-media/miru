import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import mediaPipeTasksVisionUrl from '@mediapipe/tasks-vision?url'
import modelAssetPath from 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
import * as THREE from 'three'

import { promiseWithResolvers } from 'shared/utils'

/* eslint-disable import/no-relative-packages -- files aren't exposed */
import wasmLoaderPath from '../../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url'
import wasmBinaryPath from '../../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url'
/* eslint-enable import/no-relative-packages */
import {
  DETECTION_CAMERA_FAR,
  DETECTION_CAMERA_FOV,
  DETECTION_CAMERA_NEAR,
  LANDMARK_INDICES,
  LANDMARKS_VERTEX_COUNT,
  MAX_LANDMARK_FACES,
  UVS,
} from '../../../constants'
import type { FaceLandmarksGeometryProps } from '../../../types'

import type {
  WorkerErrorData,
  WorkerFetchProgressData,
  WorkerInitData,
  WorkerInitResponse,
  WorkerResultData,
} from './detector-worker'
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
const REFERENCE_VERTEX_LEFT = 227
const REFERENCE_VERTEX_RIGHT = 447

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
  faceMeshGeometries: Record<
    number,
    { geometry: THREE.BufferGeometry; props: FaceLandmarksGeometryProps }[] | undefined
  > = {}
  facePositionAttributes: Record<
    number,
    Record<'projected' | 'unprojected', THREE.Float32BufferAttribute> | undefined
  > = {}
  INDEX_ATTR = new THREE.BufferAttribute(LANDMARK_INDICES, 1)
  CANONICAL_UVS = new THREE.BufferAttribute(UVS, 2)

  estimatedCamera = new THREE.PerspectiveCamera(
    DETECTION_CAMERA_FOV,
    1,
    DETECTION_CAMERA_NEAR,
    DETECTION_CAMERA_FAR,
  )

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
            this.onError(data.error)
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

  private async _init(): Promise<void> {
    if (this.workerInit) {
      await this.workerInit.promise
      return
    }

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

  async start(video: HTMLVideoElement, mirror = true): Promise<void> {
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

  async detect(): Promise<void> {
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
      const referenceRight = landmarks[REFERENCE_VERTEX_LEFT]
      const referenceLeft = landmarks[REFERENCE_VERTEX_RIGHT]
      vector.set(0, 0, ((referenceRight.z + referenceLeft.z) / 2) * estimatedCamera.aspect)
      vector.unproject(estimatedCamera)
      const scale = facePosition.z / vector.z

      const positionBuffers = this.getFacePossitionAttributess(faceIndex)
      const unprojected = positionBuffers.unprojected.array
      const projected = positionBuffers.projected.array

      let offset = 0
      for (let i = 0; i < LANDMARKS_VERTEX_COUNT; i++) {
        const landmark = landmarks[i]

        projected[offset + 0] = landmark.x
        projected[offset + 1] = landmark.y
        projected[offset + 2] = landmark.z

        vector.x = (landmark.x * 2 - 1) * (mirror ? -1 : 1)
        vector.y = landmark.y * -2 + 1
        vector.z = landmark.z * estimatedCamera.aspect

        vector.unproject(estimatedCamera)

        unprojected[offset + 0] = vector.x * scale
        unprojected[offset + 1] = vector.y * scale
        unprojected[offset + 2] = vector.z * scale

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

  getFacePossitionAttributess(faceIndex: number): NonNullable<this['facePositionAttributes'][number]> {
    return (this.facePositionAttributes[faceIndex] ??= {
      projected: new THREE.Float32BufferAttribute(LANDMARKS_VERTEX_COUNT * 3, 3),
      unprojected: new THREE.Float32BufferAttribute(LANDMARKS_VERTEX_COUNT * 3, 3),
    })
  }

  addFaceMesh(
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
    props: FaceLandmarksGeometryProps,
  ): void {
    const { faceId, isOccluder, uvMode } = props

    if (faceId >= MAX_LANDMARK_FACES)
      throw new Error(`Maximum ${MAX_LANDMARK_FACES} detected faces. Got ${faceId}.`)

    const { geometry, material } = mesh

    material.flatShading = false

    const positions = this.getFacePossitionAttributess(faceId)
    geometry.setAttribute('position', positions.unprojected)
    geometry.setIndex(this.INDEX_ATTR)
    geometry.attributes.position.needsUpdate = true

    if (isOccluder) {
      mesh.renderOrder = -1
      material.colorWrite = false
    } else {
      if (uvMode === 'projected') {
        geometry.setAttribute('uv', positions.projected)
        // TODO: use interactivity graph instead
        mesh.userData.useVideoTexture = true
      } else geometry.setAttribute('uv', this.CANONICAL_UVS)

      geometry.computeVertexNormals()
    }
    ;(this.faceMeshGeometries[faceId] ??= []).push({ geometry, props })
  }

  updateFaceGeometries(faceId: number, mirror: boolean): void {
    if (this.hasMirroredGeometry !== mirror) {
      const { array } = this.INDEX_ATTR
      let temp
      for (let i = 0, { length } = array; i < length; i += 3) {
        temp = array[i]
        array[i] = array[i + 2]
        array[i + 2] = temp
      }
      this.hasMirroredGeometry = mirror
    }

    this.faceMeshGeometries[faceId]?.forEach(({ geometry, props }) => {
      geometry.attributes.position.needsUpdate = true

      if (!props.isOccluder) {
        if (props.uvMode === 'projected') geometry.attributes.uv.needsUpdate = true

        geometry.computeVertexNormals()
      }
    })
  }

  dispose(): void {
    this.worker.terminate()
    this.video?.cancelVideoFrameCallback(this.rvfcHandle)
  }
}
