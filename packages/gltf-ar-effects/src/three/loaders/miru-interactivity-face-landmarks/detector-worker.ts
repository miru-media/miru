import type * as MediaPipe from '@mediapipe/tasks-vision'

export interface WorkerInitData {
  type: 'INIT'
  wasmFileset: {
    wasmLoaderPath: string
    wasmBinaryPath: string
  }
  mediaPipeTasksVisionUrl: string
  modelAssetPath: string
}

export interface WorkerInitResponse {
  type: 'init-response'
  error?: unknown
}

export interface WorkerFetchProgressData {
  type: 'fetch-progress'
  progress: number
  error?: unknown
}

export interface WorkerResultData {
  type: 'result'
  result?: MediaPipe.FaceLandmarkerResult
  error?: unknown
  timestamp: number
  image: VideoFrame
  state: unknown
}

export interface WorkerFrameData {
  type: 'frame'
  image: VideoFrame
  timestamp: number
  state: unknown
}

export interface WorkerErrorData {
  type: 'error'
  error: unknown
}

declare const self: Worker

// @ts-expect-error -- mediapipe uses this for debug messages
self.dbg = console.debug // eslint-disable-line no-console -- debug

const EXPECTED_TASK_FILE_BYTE_LENGTH = 3758596
let landmarker: MediaPipe.FaceLandmarker | undefined

Object.defineProperty(self, 'module', { value: self })
Object.defineProperty(self, 'exports', {
  get: () => ({}),
  set: (ModuleFactory: unknown) => ((self as any).ModuleFactory = ModuleFactory),
})

const postMessage = (
  data: WorkerInitResponse | WorkerResultData | WorkerFetchProgressData | WorkerErrorData,
  transfer: Transferable[] = [],
): void => self.postMessage(data, transfer)

onmessage = async (event: MessageEvent<WorkerInitData | WorkerFrameData>) => {
  const { data } = event

  switch (data.type) {
    case 'INIT': {
      const { wasmFileset, mediaPipeTasksVisionUrl, modelAssetPath } = data

      try {
        const response = await fetch(modelAssetPath)

        if (!response.ok || !response.body)
          throw new Error(`Couldn't load face detection model. ${response.status} ${response.statusText}.`)

        const contentLength =
          parseInt(response.headers.get('content-length') ?? '0', 10) || EXPECTED_TASK_FILE_BYTE_LENGTH

        let receivedLength = 0
        const teedBody = response.body.tee()

        teedBody[0]
          .pipeTo(
            new WritableStream({
              write: (chunk) => {
                receivedLength += chunk.byteLength
                const progress = Math.min(receivedLength / contentLength, 1)
                postMessage({ type: 'fetch-progress', progress })
              },
            }),
          )
          .then(() => postMessage({ type: 'fetch-progress', progress: 1 }))
          .catch((error: unknown) => postMessage({ type: 'error', error }))

        const { FaceLandmarker } = (await import(
          /* @vite-ignore */ mediaPipeTasksVisionUrl
        )) as typeof MediaPipe

        const landmarker_ = await FaceLandmarker.createFromModelBuffer(wasmFileset, teedBody[1].getReader())
        await landmarker_.setOptions({
          baseOptions: { modelAssetPath },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 2,
        })
        landmarker = landmarker_

        postMessage({ type: 'init-response' })
      } catch (error) {
        postMessage({ type: 'init-response', error })
      }
      break
    }
    case 'frame':
      {
        const { image, timestamp, state } = data
        const response: WorkerResultData = { type: 'result', result: undefined, image, timestamp, state }

        if (landmarker) {
          try {
            response.result = landmarker.detectForVideo(image, timestamp)
          } catch (error) {
            response.error = error
          }
        }

        postMessage(response, [image])
      }
      break
  }
}
