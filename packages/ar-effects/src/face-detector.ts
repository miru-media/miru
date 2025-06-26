import { type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
// eslint-disable-next-line import/default
import mediaPipeTasksVisionUrl from '@mediapipe/tasks-vision?url'
// eslint-disable-next-line import/no-unresolved
import modelAssetPath from 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

/* eslint-disable import/no-relative-packages */
import wasmLoaderPath from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url'
import wasmBinaryPath from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url'
import { WorkerErrorData, WorkerFetchProgressData, WorkerInitData, WorkerResultData } from './detector-worker'
import DetectorWorker from './detector-worker?worker'
/* eslint-enable import/no-relative-packages */

const WASM_FILESET = {
  wasmLoaderPath,
  wasmBinaryPath,
}

export class FaceDetector {
  onDetect: (data: WorkerResultData) => void
  onError: (error: unknown) => void
  timestamp = -1
  isDetecting = false
  result: FaceLandmarkerResult | undefined
  static isSync = false
  worker = new DetectorWorker()

  constructor({
    onDetect,
    onInitProgress,
    onError,
  }: {
    video: HTMLVideoElement
    onDetect: (data: WorkerResultData) => void
    onInitProgress: (progress: number) => void
    onError: (error: unknown) => void
  }) {
    this.onDetect = onDetect
    this.onError = onError

    this.worker.addEventListener(
      'message',
      ({ data }: MessageEvent<WorkerResultData | WorkerErrorData | WorkerFetchProgressData>) => {
        switch (data.type) {
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

            if (result) this.onDetect(data)
            this.isDetecting = false
          }
        }
      },
    )
  }

  init() {
    const init: WorkerInitData = {
      type: 'INIT',
      wasmFileset: WASM_FILESET,
      mediaPipeTasksVisionUrl,
      modelAssetPath,
    }
    this.worker.postMessage(init)
  }

  getImage(source: CanvasImageSource) {
    return createImageBitmap(source)
    return new VideoFrame(source)
  }

  async detect(source: CanvasImageSource) {
    const { isDetecting } = this

    if (isDetecting || source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

    const timestamp = performance.now()

    try {
      this.isDetecting = true
      const image = await this.getImage(source)
      this.worker.postMessage({ type: 'frame', image, timestamp }, [image])
    } catch (error) {
      this.onError(error)
      this.isDetecting = false
    }
  }

  dispose() {
    this.worker.terminate()
  }
}
